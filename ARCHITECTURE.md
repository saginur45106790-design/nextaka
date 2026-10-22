# Architecture and trust boundaries

Render Static Site serves React/Vite. Render Web Service serves Express `/api`. Prisma talks to Render PostgreSQL. Nothing uses Supabase or Cloudflare hosting; Cloudflare Turnstile is only the CAPTCHA provider.

REST responses use `{data: ...}` and errors `{error:{code,message}}`. Financial integer BigInts are serialized as decimal strings in paisa. Dates are UTC ISO strings; UI uses Asia/Dhaka.

The browser has no database credential. Every user query is scoped using the server session. Administrators require an active verified account and role ADMIN. RLS denies public DB access; the named trusted backend role uses explicit policies. This is **not tenant-isolated RLS for arbitrary SQL clients**.

Session tokens are random and stored only as hashes in the DB. Cookies are HttpOnly, Secure and SameSite=None in production, with Partitioned for compatible Android Chromium. All mutations require the configured frontend Origin and signed CSRF cookie/header pair. Cross-site cookie behavior must be tested on deployed URLs; custom sibling domains are recommended before money launch.

All financial posting obtains the same PostgreSQL advisory transaction lock and serializable transactions, with limited serialization retries. Wallet rows are locked and a trigger updates the ledger-derived cache. Unique actor/idempotency key + canonical request hash binds replays to payloads. Unique event keys stop duplicate postings. This conservative global lock is intentionally throughput-limited.

Revenue and reserves are recorded pending, then independently verified by a different admin. Allocation consumes both verified net revenue capacity and an independently funded reserve. Settlement turns only those funded allocations into WITHDRAWAL ledger credits. No clock generates rewards. Expired contracts can settle eligible completed historical periods to recover from interrupted scheduled jobs.

Single transactions include records, wallet effects, status histories, audit records and idempotency responses. External provider payout is a separate operation; never repeat a provider payment merely because an HTTP request timed out. Reconcile its unique settlement reference first.

Migrations are owner-only. Runtime role is configured using `backend/prisma/runtime-role.sql`. Initial free preview may use the owner account; this does not satisfy production least privilege. Backups, operator approvals and provider evidence are operational controls, not facts inferred by this software.
