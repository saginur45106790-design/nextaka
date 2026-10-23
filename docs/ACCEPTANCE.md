# Acceptance tracking

| Requirement | Source provided | Verification |
|---|---|---|
| React/Vite/Tailwind/Motion/Lucide, Bangla/English | Yes | Browser/build NOT TESTED |
| Public landing, five exact configured targets | Yes, DB seed only plan settings | DB/UI NOT TESTED |
| Argon2id registration/login/email reset/sessions | Yes, real provider integration | Unit/integration/live NOT TESTED |
| Two cash wallets + separate promotion/reserved | Yes, integer ledger + triggers | SQL integration NOT TESTED |
| Purchases, locks, idempotency | Yes | Concurrent database tests supplied, NOT RUN |
| Verified mining revenue, funded allocations | Yes, independent evidence workflow | Operational evidence not supplied |
| Scheduled settlement/catchup | CLI + optional paid Render Cron | NOT DEPLOYED |
| Deposit evidence/dual review | Yes, manual genuine-provider workflow | Merchant integration NOT CONFIGURED |
| Withdrawal reservation/release/paid evidence | Yes | SQL/provider tests NOT RUN |
| Funded referral/promotion budgets | Yes | Actual budgets NOT CONFIGURED |
| Admin sections, audit, support/content | Yes | Browser/API integration NOT TESTED |
| Database RLS/private boundaries | Explicit trusted-server role, no public access | RLS execution NOT TESTED |
| Legal/refund/privacy/risk copy | Pre-launch copy and editable content | Local legal review REQUIRED |
| Backup/restore scripts | Yes | Restore drill NOT RUN |
| Phone OTP and MFA | Honest not-configured state | Optional provider implementation remains |
| Free Render hostname | Blueprint/instructions | Availability/deployment NOT VERIFIED |
| Production launch | Fail-closed gates | NOT AUTHORIZED / NOT READY |

Source delivery does not imply acceptance tests passed. Follow TESTING.md and LAUNCH_CHECKLIST.md.
