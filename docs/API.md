# REST API

Prefix `/api`. Success `{data:...}`; failure `{error:{code,message}}`. Cookies: `credentials: include`. All non-GET mutations require exact FRONTEND_URL Origin and `X-CSRF-Token` from GET `/auth/csrf`. JSON max 32 KiB. Amounts use integer paisa strings, never JS floating-point BDT.

## Public/auth

- GET `/health`: process health. GET `/ready`: DB connection. GET `/public/config`: real plan/settings records, readiness flags, provider configuration.
- POST `/auth/register`: fullName, email, phone, password, confirmPassword, optional referralCode, turnstileToken, termsAccepted:true.
- POST `/auth/login`: email (also accepts verified phone), password, turnstileToken.
- GET `/auth/me`, POST `/auth/logout`.
- POST `/auth/verify-email`: token. POST `/auth/resend-verification`: empty body, authenticated.
- POST `/auth/forgot-password`: email, turnstileToken. POST `/auth/reset-password`: token, password.
- PATCH `/auth/profile`: fullName, optional phone, language, notificationPreferences.
- POST `/auth/change-password`: currentPassword, password.

Email tokens are in URL fragments. Frontend reads the fragment and sends token by POST; the token is never a server access-log query string.

## Authenticated reads

`/dashboard`, `/activity`, `/contracts`, `/deposits`, `/withdrawals`, `/referrals`, `/notifications`, `/support`, `/security/events`, `/security/sessions`.
`/transactions?page=1&pageSize=20&search=` is paginated (maximum page size 50). Other history endpoints cap results at 100; dashboard contracts at 50. Do not interpret a capped list as an all-time count: use backend stats.

POST `/notifications/:id/read`, `/security/sessions/:id/revoke`. POST `/support` with subject/message. POST `/account/deletion-request` with reason (10+ characters).

## Financial mutations

All below require a UUID `Idempotency-Key`. Reuse the same key and body after uncertain network failures. Different bodies with the same key fail 409.

- POST `/contracts/purchase`: planId. Browser does not choose purchase price.
- POST `/deposits`: provider (`BKASH`/`NAGAD`), amountMinor, reference, senderAccount.
- POST `/deposits/:id/cancel`: empty body; PENDING only.
- POST `/withdrawals`: provider, amountMinor, recipientAccount, recipientName, password.
- POST `/withdrawals/:id/cancel`: empty body; REQUESTED/UNDER_REVIEW only.

## Administrator writes

- `/admin/operations`: reference, providerReference, description (20+), arrangementEvidence (20+).
- `/admin/operations/:id/verify`: evidence; verifier differs from creator.
- `/admin/reserves`: purpose MINING/REFERRAL/PROMOTION, sourceType MINING_PROCEEDS/OWNER_CAPITAL/EARNED_FEES, sourceReference, evidence, amountMinor.
- `/admin/reserves/:id/verify`: evidence; independent verifier.
- `/admin/revenues`: operationId, reference, grossMinor, operatingCostMinor, periodStartsAt, periodEndsAt, evidence.
- `/admin/revenues/:id/verify`: evidence, statementReference.
- `/admin/allocations`: contractId, revenueId, reserveId, period (1-based completed 24h period), amountMinor.
- `/admin/deposits/:id/verify`: settlementReference, amountMinor, evidence, providerConfirmedAt.
- `/admin/deposits/:id/review`: action REVIEW/APPROVE/REJECT, reason. Approval admin must differ from verifier.
- `/admin/withdrawals/:id/review`: action REVIEW/APPROVE/PROCESS/PAID/REJECT, reason. PAID additionally settlementReference, evidence, settledAt; confirmer differs from approver.
- `/admin/referrals/:id/review`: action APPROVE/REJECT, reason; approval also reserveId and qualifyingDepositId.
- `/admin/promotions/:id`: reserveId, reason. One lifetime award per user, non-withdrawable.
- `/admin/contracts/:id/review`: action PAUSE/RESUME/REFUND, reason. Refund requires no reward allocations and creates a linked compensating ledger entry.
- `/admin/settlements/run`: empty body; safe duplicate execution through allocation uniqueness.

Evidence strings identify genuine statements/private records; they are not automated verification. Never store passwords, PINs or API credentials as evidence.

## Nonfinancial admin

GET `/admin/overview`; GET `/admin/:resource?page=1&pageSize=20` for the fixed allowlist in `backend/src/admin.ts`. Search is supported for users. Records never include password hashes in user listings.
POST `/admin/users/:id/status`: status ACTIVE/SUSPENDED/LOCKED, reason.
PATCH `/admin/plans/:id`: allowed plan fields + reason.
POST/PATCH announcements; POST notifications; PATCH support; POST risk/:id/review; PATCH settings; POST reconciliation. See UI action forms for exact typed fields. No arbitrary model access or arbitrary balance setter exists.
