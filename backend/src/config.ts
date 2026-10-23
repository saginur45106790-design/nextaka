import 'dotenv/config';
import { z } from 'zod';

const bool = z.enum(['true', 'false']).default('false').transform((v) => v === 'true');
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().min(1),
  FRONTEND_URL: z.url().default('http://localhost:5173'),
  SESSION_SECRET: z.string().min(32),
  IP_HASH_SECRET: z.string().min(32),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_HOSTNAMES: z.string().default('localhost'),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  SUPPORT_EMAIL: z.email().optional(),
  AUTH_TEST_BYPASS: bool,
  FINANCIAL_ACTIVITY_ENABLED: bool,
  DURABLE_INFRASTRUCTURE_CONFIRMED: bool,
  COMPLIANCE_APPROVED: bool,
  PAYMENT_OPERATIONS_READY: bool,
  BACKUPS_RESTORE_TESTED: bool,
  SECURITY_REVIEW_APPROVED: bool,
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(2).default(1),
  DISPOSABLE_EMAIL_DOMAINS: z.string().default('mailinator.com,guerrillamail.com,tempmail.com,10minutemail.com'),
});
const parsed = schema.safeParse(process.env);
if (!parsed.success) throw new Error(`Invalid backend configuration: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}. See .env.example; secret values are never printed.`);
export const config = parsed.data;
if (config.AUTH_TEST_BYPASS && config.NODE_ENV !== 'test') throw new Error('AUTH_TEST_BYPASS is forbidden outside automated tests.');
if (config.NODE_ENV === 'production' && !config.FRONTEND_URL.startsWith('https://')) throw new Error('Production FRONTEND_URL requires HTTPS.');
export const frontendOrigin = new URL(config.FRONTEND_URL).origin;
export const emailConfigured = Boolean(config.EMAIL_API_KEY && config.EMAIL_FROM);
