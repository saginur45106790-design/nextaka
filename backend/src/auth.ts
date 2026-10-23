import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { prisma } from './db.js';
import { AppError } from './errors.js';
import { config } from './config.js';
import { hashPassword, verifyPassword, randomToken, tokenHash, hmacHash } from './crypto.js';
import { requireEmailProvider, sendAuthEmail } from './mail.js';
import { createSession, requireAuth, issueCsrf, safeUser, rateLimit, consumeRateLimit, event, ipHash, verifyTurnstile, cookieOptions, sessionCookieName } from './security.js';

export const authRouter = Router();
export const passwordSchema = z.string().min(12, 'Use at least 12 characters.').max(128).regex(/[a-zA-Z]/, 'Include a letter.').regex(/[0-9]/, 'Include a number.');
const emailSchema = z.email().max(254).transform((v) => v.trim().toLowerCase());
const phoneSchema = z.string().trim().regex(/^(?:\+?880|0)1[3-9]\d{8}$/, 'Enter a Bangladesh mobile number.').transform((v) => `+880${v.replace(/^\+?880|^0/, '')}`);
const captcha = z.string().min(1).max(2048);
const registerSchema = z.object({ fullName: z.string().trim().min(2).max(100), email: emailSchema, phone: phoneSchema,
  password: passwordSchema, confirmPassword: z.string(), referralCode: z.string().trim().max(32).optional(), turnstileToken: captcha, termsAccepted: z.literal(true) })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' });
const dummyPassword = hashPassword(randomToken());
const authWindow = 15 * 60_000;

authRouter.get('/csrf', (req, res) => { res.set('Cache-Control', 'no-store').json({ data: { csrfToken: issueCsrf(req, res) } }); });
authRouter.get('/me', requireAuth, (req, res) => res.json({ data: { user: safeUser(req.user!) } }));

authRouter.post('/register', rateLimit('register', 5, 3_600_000), async (req, res) => {
  const input = registerSchema.parse(req.body);
  await verifyTurnstile(input.turnstileToken, req, 'register');
  requireEmailProvider();
  const domain = input.email.split('@')[1]!;
  if (config.DISPOSABLE_EMAIL_DOMAINS.split(',').map((v) => v.trim().toLowerCase()).includes(domain)) {
    await event(req, 'DISPOSABLE_EMAIL_REJECTED');
    throw new AppError(400, 'EMAIL_UNSUPPORTED', 'Use a permanent email address. Contact support if this is a mistake.');
  }
  const passwordHash = await hashPassword(input.password);
  const token = randomToken();
  const addressHash = ipHash(req);
  const deviceHash = hmacHash(req.get('user-agent') ?? 'unknown', config.IP_HASH_SECRET);
  const recentRegistrations = await prisma.securityEvent.count({ where: { type: 'REGISTERED', ipHash: addressHash, createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
  const user = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) throw new AppError(409, 'ACCOUNT_EXISTS', 'This email is already registered. Sign in or reset your password.');
    const referrer = input.referralCode ? await tx.user.findUnique({ where: { referralCode: input.referralCode }, select: { id: true, email: true, status: true } }) : null;
    if (input.referralCode && (!referrer || referrer.status !== 'ACTIVE')) throw new AppError(400, 'REFERRAL_INVALID', 'This referral code is unavailable.');
    const created = await tx.user.create({ data: { fullName: input.fullName, email: input.email, phone: input.phone, passwordHash,
      referralCode: randomBytes(6).toString('hex').toUpperCase(), termsAcceptedAt: new Date(),
      wallets: { create: ['MAIN', 'WITHDRAWAL', 'PROMOTIONAL', 'RESERVED'].map((kind) => ({ kind })) },
      termsAcceptances: { create: { version: '2026-10-v1' } },
      authTokens: { create: { tokenHash: tokenHash(token), kind: 'VERIFY_EMAIL', expiresAt: new Date(Date.now() + 86_400_000) } },
    } });
    if (referrer) await tx.referralRelationship.create({ data: { referrerId: referrer.id, referredId: created.id } });
    await tx.securityEvent.create({ data: { type: 'REGISTERED', userId: created.id, ipHash: addressHash, metadata: { deviceHash } } });
    if (recentRegistrations >= 2) await tx.riskFlag.create({ data: { userId: created.id, type: 'SHARED_REGISTRATION_IP', reason: 'Multiple registrations within 24h share a salted IP signal. Shared mobile/family networks can be legitimate; manual review only.' } });
    return created;
  });
  await createSession(req, res, user.id);
  try { await sendAuthEmail(user.email, token, 'VERIFY_EMAIL'); }
  catch (error) { await event(req, 'VERIFICATION_DELIVERY_FAILED', user.id); throw error; }
  res.status(201).json({ data: { user: safeUser(user), message: 'Check your email to verify your account. No financial activity is enabled by registration.' } });
});

authRouter.post('/login', rateLimit('login-ip', 25, authWindow), async (req, res) => {
  const input = z.object({ email: z.string().trim().min(3).max(254).transform(v => v.toLowerCase()), password: z.string().min(1).max(128), turnstileToken: captcha }).parse(req.body);
  await verifyTurnstile(input.turnstileToken, req, 'login');
  await consumeRateLimit(`login-account:${hmacHash(input.email, config.IP_HASH_SECRET)}`, 12, authWindow);
  const loginPhone = phoneSchema.safeParse(input.email);
  const user = loginPhone.success ? await prisma.user.findUnique({ where: { verifiedPhone: loginPhone.data } }) : await prisma.user.findUnique({ where: { email: input.email } });
  const valid = await verifyPassword(input.password, user?.passwordHash ?? await dummyPassword);
  if (!user || !valid) {
    await event(req, 'LOGIN_FAILED', user?.id);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }
  if (user.status !== 'ACTIVE') {
    await event(req, 'RESTRICTED_LOGIN', user.id);
    throw new AppError(403, 'ACCOUNT_RESTRICTED', 'This account is restricted. Contact support for an appeal.');
  }
  // Rotate any existing session to prevent session fixation.
  const previous = req.cookies?.[sessionCookieName];
  if (typeof previous === 'string') await prisma.session.deleteMany({ where: { tokenHash: tokenHash(previous) } });
  await createSession(req, res, user.id);
  await event(req, 'LOGIN_SUCCEEDED', user.id);
  res.json({ data: { user: safeUser(user) } });
});

authRouter.post('/logout', async (req, res) => {
  const raw = req.cookies?.[sessionCookieName];
  if (typeof raw === 'string') await prisma.session.deleteMany({ where: { tokenHash: tokenHash(raw) } });
  res.clearCookie(sessionCookieName, cookieOptions).json({ data: { success: true } });
});

authRouter.post('/verify-email', rateLimit('verify-email', 20, authWindow), async (req, res) => {
  const { token } = z.object({ token: z.string().min(32).max(128) }).parse(req.body);
  const found = await prisma.authToken.findUnique({ where: { tokenHash: tokenHash(token) } });
  if (!found || found.kind !== 'VERIFY_EMAIL' || found.usedAt || found.expiresAt <= new Date()) throw new AppError(400, 'TOKEN_INVALID', 'Verification link expired or already used. Request a new link.');
  await prisma.$transaction(async (tx) => {
    const consumed = await tx.authToken.updateMany({ where: { id: found.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
    if (consumed.count !== 1) throw new AppError(400, 'TOKEN_INVALID', 'Verification link has already been used.');
    const user = await tx.user.update({ where: { id: found.userId }, data: { emailVerifiedAt: new Date() } });
    await tx.verifiedContact.upsert({ where: { kind_value: { kind: 'EMAIL', value: user.email } }, create: { userId: user.id, kind: 'EMAIL', value: user.email, provider: 'EMAIL_LINK' }, update: {} });
    await tx.securityEvent.create({ data: { userId: user.id, type: 'EMAIL_VERIFIED', ipHash: ipHash(req) } });
  });
  res.json({ data: { success: true, message: 'Email verified. Promotional credit, if enabled and funded, requires an eligibility review.' } });
});

authRouter.post('/resend-verification', requireAuth, rateLimit('resend-verification', 4, 3_600_000), async (req, res) => {
  if (req.user!.emailVerifiedAt) return res.json({ data: { success: true } });
  requireEmailProvider();
  const token = randomToken();
  await prisma.$transaction([
    prisma.authToken.updateMany({ where: { userId: req.user!.id, kind: 'VERIFY_EMAIL', usedAt: null }, data: { usedAt: new Date() } }),
    prisma.authToken.create({ data: { userId: req.user!.id, kind: 'VERIFY_EMAIL', tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 86_400_000) } }),
  ]);
  await sendAuthEmail(req.user!.email, token, 'VERIFY_EMAIL');
  res.json({ data: { success: true } });
});

authRouter.post('/forgot-password', rateLimit('forgot-password', 5, authWindow), async (req, res) => {
  const input = z.object({ email: emailSchema, turnstileToken: captcha }).parse(req.body);
  await verifyTurnstile(input.turnstileToken, req, 'forgot_password');
  requireEmailProvider();
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (user) {
    const token = randomToken();
    await prisma.$transaction([
      prisma.authToken.updateMany({ where: { userId: user.id, kind: 'RESET_PASSWORD', usedAt: null }, data: { usedAt: new Date() } }),
      prisma.authToken.create({ data: { userId: user.id, tokenHash: tokenHash(token), kind: 'RESET_PASSWORD', expiresAt: new Date(Date.now() + 30 * 60_000) } }),
    ]);
    try { await sendAuthEmail(user.email, token, 'RESET_PASSWORD'); } catch { await event(req, 'RESET_DELIVERY_FAILED', user.id); }
    await event(req, 'PASSWORD_RESET_REQUESTED', user.id);
  }
  res.json({ data: { message: 'If an account exists, a password reset link will be emailed.' } });
});

authRouter.post('/reset-password', rateLimit('reset-password', 10, authWindow), async (req, res) => {
  const input = z.object({ token: z.string().min(32).max(128), password: passwordSchema }).parse(req.body);
  const found = await prisma.authToken.findUnique({ where: { tokenHash: tokenHash(input.token) } });
  if (!found || found.kind !== 'RESET_PASSWORD' || found.usedAt || found.expiresAt <= new Date()) throw new AppError(400, 'TOKEN_INVALID', 'Password reset link expired or already used.');
  const passwordHash = await hashPassword(input.password);
  await prisma.$transaction(async (tx) => {
    const used = await tx.authToken.updateMany({ where: { id: found.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
    if (used.count !== 1) throw new AppError(400, 'TOKEN_INVALID', 'This reset link has already been used.');
    await tx.user.update({ where: { id: found.userId }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { userId: found.userId } });
    await tx.authToken.updateMany({ where: { userId: found.userId, kind: 'RESET_PASSWORD', usedAt: null }, data: { usedAt: new Date() } });
    await tx.securityEvent.create({ data: { userId: found.userId, type: 'PASSWORD_RESET', ipHash: ipHash(req) } });
  });
  res.clearCookie(sessionCookieName, cookieOptions).json({ data: { success: true } });
});

authRouter.patch('/profile', requireAuth, async (req, res) => {
  const input = z.object({ fullName: z.string().trim().min(2).max(100), phone: phoneSchema.optional(), language: z.enum(['bn', 'en']).optional(),
    notificationPreferences: z.object({ announcements: z.boolean().optional(), security: z.literal(true).optional() }).optional() }).strict().parse(req.body);
  const changedPhone = input.phone !== undefined && input.phone !== req.user!.phone;
  const user = await prisma.user.update({ where: { id: req.user!.id }, data: { ...input, ...(changedPhone ? { verifiedPhone: null, phoneVerifiedAt: null } : {}) } });
  await event(req, 'PROFILE_UPDATED', user.id);
  res.json({ data: { user: safeUser(user) } });
});

authRouter.post('/change-password', requireAuth, rateLimit('password-change', 5, authWindow), async (req, res) => {
  const input = z.object({ currentPassword: z.string().max(128), password: passwordSchema }).parse(req.body);
  if (!await verifyPassword(input.currentPassword, req.user!.passwordHash)) throw new AppError(400, 'PASSWORD_INCORRECT', 'Current password is incorrect.');
  await prisma.$transaction([
    prisma.user.update({ where: { id: req.user!.id }, data: { passwordHash: await hashPassword(input.password) } }),
    prisma.session.deleteMany({ where: { userId: req.user!.id } }),
    prisma.authToken.updateMany({ where: { userId: req.user!.id, kind: 'RESET_PASSWORD', usedAt: null }, data: { usedAt: new Date() } }),
  ]);
  await createSession(req, res, req.user!.id);
  await event(req, 'PASSWORD_CHANGED', req.user!.id);
  res.json({ data: { success: true } });
});
