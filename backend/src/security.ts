import type { Request, Response, NextFunction } from 'express';
import type { Prisma, User } from '@prisma/client';
import { config, frontendOrigin } from './config.js';
import { prisma } from './db.js';
import { AppError } from './errors.js';
import { constantTimeEqual, hmacHash, randomToken, tokenHash } from './crypto.js';

declare global {
  namespace Express {
    interface Request { user?: User; sessionId?: string }
  }
}
const production = config.NODE_ENV === 'production';
export const sessionCookieName = production ? '__Host-nextaka_session' : 'nextaka_session';
const csrfCookieName = production ? '__Host-nextaka_csrf' : 'nextaka_csrf';
export const cookieOptions = { httpOnly: true, secure: production, partitioned: production, sameSite: production ? 'none' as const : 'lax' as const, path: '/' };
export const ipHash = (req: Request) => hmacHash(req.ip ?? 'unknown', config.IP_HASH_SECRET);
export function safeUser(user: User) {
  return { id: user.id, fullName: user.fullName, email: user.email, phone: user.phone, emailVerifiedAt: user.emailVerifiedAt,
    phoneVerifiedAt: user.phoneVerifiedAt, role: user.role, status: user.status, referralCode: user.referralCode,
    language: user.language, notificationPreferences: user.notificationPreferences, deletionRequestedAt: user.deletionRequestedAt, createdAt: user.createdAt };
}
export function issueCsrf(req: Request, res: Response): string {
  let token = req.cookies?.[csrfCookieName] as string | undefined;
  if (!token || !validCsrfToken(token)) {
    const data = `${randomToken()}.${Date.now() + 86_400_000}`;
    token = `${data}.${hmacHash(data, config.SESSION_SECRET)}`;
  }
  res.cookie(csrfCookieName, token, { ...cookieOptions, maxAge: 86_400_000 });
  return token;
}
export function validCsrfToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [nonce, expiry, signature] = parts;
  if (!nonce || !expiry || !signature || !Number.isFinite(Number(expiry)) || Number(expiry) <= Date.now() || Number(expiry) > Date.now() + 86_400_001) return false;
  return constantTimeEqual(hmacHash(`${nonce}.${expiry}`, config.SESSION_SECRET), signature);
}
export function csrfProtection(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('origin') !== frontendOrigin) return next(new AppError(403, 'ORIGIN_REJECTED', 'Request origin is not permitted.'));
  const token = req.get('x-csrf-token');
  const cookie = req.cookies?.[csrfCookieName];
  if (!token || typeof cookie !== 'string' || !constantTimeEqual(token, cookie) || !validCsrfToken(token)) {
    return next(new AppError(403, 'CSRF_INVALID', 'Security token expired. Refresh this page and try again.'));
  }
  next();
}
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const raw = req.cookies?.[sessionCookieName];
  if (typeof raw !== 'string' || raw.length > 100) throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
  const session = await prisma.session.findUnique({ where: { tokenHash: tokenHash(raw) }, include: { user: true } });
  if (!session || session.expiresAt <= new Date()) throw new AppError(401, 'SESSION_EXPIRED', 'Your session expired. Please sign in again.');
  if (session.user.status !== 'ACTIVE') throw new AppError(403, 'ACCOUNT_RESTRICTED', 'This account is restricted. Contact support to request a review.');
  req.user = session.user;
  req.sessionId = session.id;
  if (session.lastSeenAt.getTime() < Date.now() - 300_000) await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  next();
}
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) await requireAuth(req, res, () => {});
  if (!req.user || req.user.role !== 'ADMIN' || !req.user.emailVerifiedAt) throw new AppError(403, 'FORBIDDEN', 'Administrator access is required.');
  next();
}
export async function createSession(req: Request, res: Response, userId: string) {
  const token = randomToken();
  const csrf = issueCsrf(req, res);
  await prisma.session.create({ data: { userId, tokenHash: tokenHash(token), csrfHash: tokenHash(csrf), expiresAt: new Date(Date.now() + 7 * 86_400_000), ipHash: ipHash(req), userAgent: req.get('user-agent')?.slice(0, 256) } });
  res.cookie(sessionCookieName, token, { ...cookieOptions, maxAge: 7 * 86_400_000 });
}
export async function event(req: Request, type: string, userId?: string, metadata: Prisma.InputJsonValue = {}) {
  return prisma.securityEvent.create({ data: { type, userId, ipHash: ipHash(req), metadata } });
}
// PostgreSQL-backed limits survive Render restarts and work across replicas. Shared IPs are rate limited, never blanket banned.
export async function consumeRateLimit(key: string, limit: number, windowMs: number): Promise<void> {
  const expiresAt = new Date(Date.now() + windowMs);
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "RateLimit" ("key", "count", "expiresAt") VALUES (${key}, 1, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."expiresAt" < NOW() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "expiresAt" = CASE WHEN "RateLimit"."expiresAt" < NOW() THEN ${expiresAt} ELSE "RateLimit"."expiresAt" END
    RETURNING "count"`;
  if ((rows[0]?.count ?? limit + 1) > limit) throw new AppError(429, 'RATE_LIMITED', 'Too many attempts. Please wait before trying again.');
}
export const rateLimit = (scope: string, limit: number, windowMs: number) => async (req: Request, _res: Response, next: NextFunction) => {
  await consumeRateLimit(`${scope}:${ipHash(req)}`, limit, windowMs); next();
};
export async function verifyTurnstile(token: string, req: Request, action: string): Promise<void> {
  if (config.NODE_ENV === 'test' && config.AUTH_TEST_BYPASS) return;
  if (!config.TURNSTILE_SECRET_KEY) throw new AppError(503, 'CAPTCHA_NOT_CONFIGURED', 'CAPTCHA verification is not configured. Registration and login are unavailable.');
  let result: { success?: boolean; hostname?: string; action?: string };
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: config.TURNSTILE_SECRET_KEY, response: token, remoteip: req.ip ?? '' }), signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error('captcha transport');
    result = await response.json() as typeof result;
  } catch { throw new AppError(503, 'CAPTCHA_UNAVAILABLE', 'CAPTCHA could not be checked. Please try again.'); }
  const hosts = config.TURNSTILE_HOSTNAMES.split(',').map((h) => h.trim());
  if (!result.success || !result.hostname || !hosts.includes(result.hostname) || result.action !== action) {
    await event(req, 'CAPTCHA_REJECTED');
    throw new AppError(400, 'CAPTCHA_INVALID', 'Complete a new CAPTCHA verification and try again.');
  }
}
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => { void fn(req, res, next).catch(next); };
}
