import { config, emailConfigured } from './config.js';
import { AppError } from './errors.js';
export function requireEmailProvider() {
  if (!emailConfigured && !(config.NODE_ENV === 'test' && config.AUTH_TEST_BYPASS)) throw new AppError(503, 'EMAIL_NOT_CONFIGURED', 'Email verification is not configured. Please contact the operator.');
}
export async function sendAuthEmail(email: string, token: string, kind: 'VERIFY_EMAIL' | 'RESET_PASSWORD') {
  requireEmailProvider();
  if (config.NODE_ENV === 'test' && config.AUTH_TEST_BYPASS) return;
  const label = kind === 'VERIFY_EMAIL' ? 'ইমেইল যাচাই করুন / Verify email' : 'পাসওয়ার্ড পুনরায় সেট করুন / Reset password';
  // URL fragments keep the secret token out of HTTP request logs and referrer headers.
  const path = kind === 'VERIFY_EMAIL' ? '/verify-email' : '/reset-password';
  const url = `${config.FRONTEND_URL.replace(/\/$/, '')}${path}#token=${encodeURIComponent(token)}`;
  try {
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${config.EMAIL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.EMAIL_FROM, to: email, subject: `NEXTAKA — ${label}`, text: `NEXTAKA\n\n${label}\n${url}\n\nএই লিংক গোপন রাখুন। আপনি অনুরোধ না করলে উপেক্ষা করুন।\nKeep this link private. Ignore this email if you did not request it.`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;background:#0b1520;color:#eef7fa"><h1 style="color:#40e7b0">NEXTAKA</h1><h2>${label}</h2><p>আপনার অ্যাকাউন্ট সুরক্ষিত রাখুন।</p><p><a style="color:#40e7b0" href="${url}">${label}</a></p><p>This private link expires automatically. If you did not request it, ignore this email.</p></div>` }),
    });
    if (!response.ok) throw new Error('email rejected');
  } catch { throw new AppError(503, 'EMAIL_DELIVERY_FAILED', 'Email delivery is unavailable. Please retry the verification request later.'); }
}
