# Data and accounting model

Prisma schema is authoritative for model fields. SQL migrations add integrity controls not expressible in Prisma: immutable rows, nonnegative accounts, guarded ledger cache, unique lifetime promotional award, checks and additional actor foreign keys.

Identity: User (single role USER/ADMIN), Session, AuthToken, VerifiedContact, TermsAcceptance, RateLimit, SecurityEvent, RiskFlag. User roles are stored as a constrained single-role column, not a separate many-to-many role table.

Wallet: WalletAccount per user/kind; WalletLedger signed paisa movements; WalletReservation tied one-to-one to a withdrawal. `balanceMinor` is a trigger-maintained cache; API financial balances aggregate the ledger. No initial cash is seeded. Ledger is a wallet subledger, not a complete corporate double-entry general ledger; external bank/custody reconciliation remains necessary.

Mining: MachinePlan configured targets; MachineContract purchase-time snapshot; MiningOperation evidence; MiningRevenue gross/cost/net/allocated; RevenueVerification independent statement; PayoutReserve independently funded budget; RewardAllocation per contract/period; MiningSettlement per allocation and contract/period.

Payment: DepositRequest, PaymentVerification, DepositHistory; WithdrawalRequest, WithdrawalSettlement, WithdrawalHistory. Provider settlement references are unique within the provider. Status histories remain immutable.

Campaigns: ReferralRelationship (one referrer per referred user, no self-referral); ReferralCommission (one per relationship and qualifying deposit); PromotionalCredit (one lifetime welcome award per user). Campaign values are configuration, not available funds.

Operations: Notification, SupportTicket, Announcement, SiteSetting, AuditLog, ReconciliationRun, IdempotencyKey.

Dates are stored as PostgreSQL timestamp(3) using Prisma UTC values; display and activity bucketing use Asia/Dhaka. Use UTC database/session configuration. Financial numbers must never be converted to floats during posting. Chart Number conversion is visual only.

RLS: PUBLIC has no schema/table privileges. Trusted server role receives explicit policies; API is the tenant authorization boundary. SQL owners can bypass database restrictions, so restrict migration-owner access and monitor it. No promise that a malicious database owner can be made unable to alter the database.
