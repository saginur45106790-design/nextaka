# Authentication and recovery

Argon2id: 64 MiB memory, three iterations, one lane, random salt. Minimum password length 12, at least a letter and number; frontend registration requires upper/lowercase too. Hashes, not plaintext, are stored. Database sessions store SHA-256 hashes of random 256-bit opaque tokens. Seven-day lifetime; rotation on login; password reset/change revokes old sessions.

CAPTCHA verifies server-side success, expected hostname and action. Test bypass is accepted only under NODE_ENV=test and never in production. Database rate limits survive service sleep/restarts. Shared IP signals produce review flags, not blanket permanent bans. A manual false-positive appeal must use monitored support.

Registration needs a configured email provider. Verification token lifetime 24h; reset 30m; single use enforced transactionally. Registration can persist even if delivery fails: login and resend verification instead of registering repeatedly. Email uniqueness is normalized lowercase. Only provider-verified phones may be login identifiers; no OTP provider is implemented or claimed configured.

Production cookies: HttpOnly, Secure, SameSite=None, Partitioned. Android Chrome with CHIPS supports cross-site cookies scoped to the frontend's top-level site. Browser privacy configurations differ; verify actual deployed login/refresh/logout. For unsupported environments use same-site custom frontend/API domains and configure CORS/CSP. Never switch to localStorage bearer tokens to bypass this requirement.

Changing account phone clears phone verification. MFA is explicitly Not configured. Independent MFA/passkey integration and recovery review remain a production hardening item; no fake toggle is provided.

Initial admins must already register and verify email. Run `npm run admin:create --workspace backend -- --email verified-address` through trusted owner access. No preset password and no public bootstrap endpoint. The role change is audited and existing sessions are revoked. Two independent administrators are necessary for financial review; do not share credentials.
