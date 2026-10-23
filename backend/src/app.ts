import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import pino from 'pino';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { config, frontendOrigin } from './config.js';
import { prisma } from './db.js';
import { AppError } from './errors.js';
import { csrfProtection, rateLimit } from './security.js';
import { authRouter } from './auth.js';
import { publicRouter, userRouter } from './routes.js';
import { adminRouter } from './admin.js';
import { financeRouter } from './finance-routes.js';

export const logger = pino({ level: config.NODE_ENV === 'test' ? 'silent' : 'info', redact: ['password', 'token', 'cookie', 'authorization', 'DATABASE_URL', 'EMAIL_API_KEY'] });
export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.TRUST_PROXY_HOPS);
app.set('json replacer', (_key: string, value: unknown) => typeof value === 'bigint' ? value.toString() : value);
app.use(helmet({ referrerPolicy: { policy: 'no-referrer' }, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use((req, res, next) => {
  const id = randomUUID(); res.set('X-Request-Id', id); res.set('Cache-Control', 'no-store');
  res.on('finish', () => logger.info({ requestId: id, method: req.method, path: req.path, status: res.statusCode }, 'request'));
  next();
});
app.use(cors({ origin: (origin, callback) => {
  if (!origin || origin === frontendOrigin) return callback(null, true);
  callback(new AppError(403, 'ORIGIN_REJECTED', 'Request origin is not permitted.'));
}, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Idempotency-Key'] }));
app.use(express.json({ limit: '32kb', type: 'application/json' }));
app.use(cookieParser());
app.get('/api/health', (_req, res) => res.json({ data: { status: 'ok', service: 'NEXTAKA API' } }));
app.get('/api/ready', async (_req, res) => { await prisma.$queryRaw`SELECT 1`; res.json({ data: { status: 'ready' } }); });
app.use('/api', csrfProtection, rateLimit('api', 600, 60_000));
app.use('/api/auth', authRouter);
app.use('/api/public', publicRouter);
app.use('/api', financeRouter);
app.use('/api/admin', adminRouter);
app.use('/api', userRouter);
app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Endpoint not found.')));
const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof AppError) return void res.status(error.status).json({ error: { code: error.code, message: error.message } });
  if (error instanceof ZodError) return void res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ') } });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return void res.status(409).json({ error: { code: 'DUPLICATE_RECORD', message: 'This request conflicts with an existing record. Please refresh and review its status.' } });
    if (error.code === 'P2025') return void res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Record not found.' } });
    if (error.code === 'P2034') return void res.status(409).json({ error: { code: 'RETRY_TRANSACTION', message: 'A concurrent transaction changed this record. Retry with the same idempotency key.' } });
  }
  if (error instanceof SyntaxError) return void res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body must contain valid JSON.' } });
  const status = typeof error === 'object' && error !== null && 'status' in error && error.status === 413 ? 413 : 500;
  // No raw error messages, request bodies, credentials, email links or database URLs in logs.
  logger.error({ requestId: res.getHeader('X-Request-Id'), errorType: error instanceof Error ? error.name : 'Unknown' }, 'request failed');
  res.status(status).json({ error: { code: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR', message: status === 413 ? 'Request is too large.' : 'The request could not be completed. Please retry or contact support with the request ID.' } });
};
app.use(errorHandler);
