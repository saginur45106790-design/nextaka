-- Initial normalized schema. No users, money, revenue or payment fixtures.
CREATE TABLE "User" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "phone" TEXT,
  "verifiedPhone" TEXT,
  "passwordHash" TEXT NOT NULL,
  "emailVerifiedAt" TIMESTAMP(3),
  "phoneVerifiedAt" TIMESTAMP(3),
  "role" TEXT NOT NULL DEFAULT 'USER',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "referralCode" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'bn',
  "notificationPreferences" JSONB NOT NULL DEFAULT '{}',
  "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
  "deletionRequestedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
  "id" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "csrfHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipHash" TEXT,
  "userAgent" TEXT,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthToken" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RateLimit" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "VerifiedContact" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "provider" TEXT NOT NULL,
  CONSTRAINT "VerifiedContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TermsAcceptance" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "version" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TermsAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityEvent" (
  "id" UUID NOT NULL,
  "userId" UUID,
  "type" TEXT NOT NULL,
  "ipHash" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RiskFlag" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "reviewedBy" TEXT,
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RiskFlag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WalletAccount" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "balanceMinor" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WalletAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WalletLedger" (
  "id" UUID NOT NULL,
  "accountId" UUID NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "balanceAfter" BIGINT NOT NULL DEFAULT 0,
  "eventKey" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "referenceId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "actorId" UUID,
  "reversalOfId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WalletLedger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WalletReservation" (
  "id" UUID NOT NULL,
  "withdrawalRequestId" UUID NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'HELD',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedAt" TIMESTAMP(3),
  CONSTRAINT "WalletReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MachinePlan" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "priceMinor" BIGINT NOT NULL,
  "durationDays" INTEGER NOT NULL,
  "dailyTargetMinor" BIGINT NOT NULL,
  "totalTargetMinor" BIGINT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "operationId" UUID,
  "specifications" JSONB NOT NULL DEFAULT '{}',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MachinePlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MiningOperation" (
  "id" UUID NOT NULL,
  "reference" TEXT NOT NULL,
  "providerReference" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "arrangementEvidence" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdById" UUID NOT NULL,
  "verifiedById" UUID,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MiningOperation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MachineContract" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "planId" TEXT NOT NULL,
  "operationId" UUID NOT NULL,
  "priceMinor" BIGINT NOT NULL,
  "dailyTargetMinor" BIGINT NOT NULL,
  "totalTargetMinor" BIGINT NOT NULL,
  "durationDays" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MachineContract_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayoutReserve" (
  "id" UUID NOT NULL,
  "purpose" TEXT NOT NULL,
  "sourceReference" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "evidence" TEXT NOT NULL,
  "fundedMinor" BIGINT NOT NULL,
  "availableMinor" BIGINT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdById" UUID NOT NULL,
  "verifiedById" UUID,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayoutReserve_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MiningRevenue" (
  "id" UUID NOT NULL,
  "operationId" UUID NOT NULL,
  "reference" TEXT NOT NULL,
  "grossMinor" BIGINT NOT NULL,
  "operatingCostMinor" BIGINT NOT NULL,
  "netMinor" BIGINT NOT NULL,
  "allocatedMinor" BIGINT NOT NULL DEFAULT 0,
  "periodStartsAt" TIMESTAMP(3) NOT NULL,
  "periodEndsAt" TIMESTAMP(3) NOT NULL,
  "evidence" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdById" UUID NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MiningRevenue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RevenueVerification" (
  "id" UUID NOT NULL,
  "revenueId" UUID NOT NULL,
  "verifiedById" UUID NOT NULL,
  "evidence" TEXT NOT NULL,
  "statementReference" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RevenueVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RewardAllocation" (
  "id" UUID NOT NULL,
  "contractId" UUID NOT NULL,
  "revenueId" UUID NOT NULL,
  "reserveId" UUID NOT NULL,
  "period" INTEGER NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'APPROVED',
  "approvedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RewardAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MiningSettlement" (
  "id" UUID NOT NULL,
  "contractId" UUID NOT NULL,
  "allocationId" UUID NOT NULL,
  "period" INTEGER NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MiningSettlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DepositRequest" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "reference" TEXT NOT NULL,
  "senderAccount" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "rejectionReason" TEXT,
  "reviewedById" UUID,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DepositRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentVerification" (
  "id" UUID NOT NULL,
  "depositId" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "settlementReference" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "evidence" TEXT NOT NULL,
  "verifiedById" UUID NOT NULL,
  "providerConfirmedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DepositHistory" (
  "id" UUID NOT NULL,
  "depositId" UUID NOT NULL,
  "status" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "actorId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DepositHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WithdrawalRequest" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "feeMinor" BIGINT NOT NULL,
  "recipientAccount" TEXT NOT NULL,
  "recipientName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "rejectionReason" TEXT,
  "reviewedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WithdrawalRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WithdrawalSettlement" (
  "id" UUID NOT NULL,
  "withdrawalId" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "settlementReference" TEXT NOT NULL,
  "evidence" TEXT NOT NULL,
  "settledById" UUID NOT NULL,
  "settledAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WithdrawalSettlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WithdrawalHistory" (
  "id" UUID NOT NULL,
  "withdrawalId" UUID NOT NULL,
  "status" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "actorId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WithdrawalHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralRelationship" (
  "id" UUID NOT NULL,
  "referrerId" UUID NOT NULL,
  "referredId" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralRelationship_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralCommission" (
  "id" UUID NOT NULL,
  "relationshipId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "reserveId" UUID NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "qualifyingDepositId" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'APPROVED',
  "reviewNote" TEXT NOT NULL,
  "reviewedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralCommission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionalCredit" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "campaign" TEXT NOT NULL,
  "reserveId" UUID NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "reviewedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromotionalCredit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportTicket" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "adminReply" TEXT,
  "repliedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Announcement" (
  "id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SiteSetting" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedById" UUID,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "AuditLog" (
  "id" UUID NOT NULL,
  "actorId" UUID,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReconciliationRun" (
  "id" UUID NOT NULL,
  "status" TEXT NOT NULL,
  "findings" JSONB NOT NULL,
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReconciliationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IdempotencyKey" (
  "id" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "response" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE UNIQUE INDEX "User_verifiedPhone_key" ON "User"("verifiedPhone");

CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

CREATE INDEX "User_status_createdAt_idx" ON "User"("status", "createdAt");

CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

CREATE INDEX "Session_userId_idx" ON "Session"("userId");

CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

CREATE INDEX "AuthToken_expiresAt_idx" ON "AuthToken"("expiresAt");

CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");

CREATE UNIQUE INDEX "VerifiedContact_kind_value_key" ON "VerifiedContact"("kind", "value");

CREATE UNIQUE INDEX "TermsAcceptance_userId_version_key" ON "TermsAcceptance"("userId", "version");

CREATE INDEX "SecurityEvent_userId_createdAt_idx" ON "SecurityEvent"("userId", "createdAt");

CREATE INDEX "SecurityEvent_type_createdAt_idx" ON "SecurityEvent"("type", "createdAt");

CREATE INDEX "RiskFlag_status_createdAt_idx" ON "RiskFlag"("status", "createdAt");

CREATE UNIQUE INDEX "WalletAccount_userId_kind_key" ON "WalletAccount"("userId", "kind");

CREATE UNIQUE INDEX "WalletLedger_eventKey_key" ON "WalletLedger"("eventKey");

CREATE UNIQUE INDEX "WalletLedger_reversalOfId_key" ON "WalletLedger"("reversalOfId");

CREATE INDEX "WalletLedger_accountId_createdAt_idx" ON "WalletLedger"("accountId", "createdAt");

CREATE INDEX "WalletLedger_kind_createdAt_idx" ON "WalletLedger"("kind", "createdAt");

CREATE UNIQUE INDEX "WalletReservation_withdrawalRequestId_key" ON "WalletReservation"("withdrawalRequestId");

CREATE UNIQUE INDEX "MiningOperation_reference_key" ON "MiningOperation"("reference");

CREATE INDEX "MachineContract_userId_status_idx" ON "MachineContract"("userId", "status");

CREATE INDEX "MachineContract_status_endsAt_idx" ON "MachineContract"("status", "endsAt");

CREATE UNIQUE INDEX "PayoutReserve_sourceReference_key" ON "PayoutReserve"("sourceReference");

CREATE UNIQUE INDEX "MiningRevenue_reference_key" ON "MiningRevenue"("reference");

CREATE INDEX "MiningRevenue_operationId_status_idx" ON "MiningRevenue"("operationId", "status");

CREATE UNIQUE INDEX "RevenueVerification_revenueId_key" ON "RevenueVerification"("revenueId");

CREATE UNIQUE INDEX "RevenueVerification_statementReference_key" ON "RevenueVerification"("statementReference");

CREATE UNIQUE INDEX "RewardAllocation_contractId_period_key" ON "RewardAllocation"("contractId", "period");

CREATE INDEX "RewardAllocation_status_createdAt_idx" ON "RewardAllocation"("status", "createdAt");

CREATE UNIQUE INDEX "MiningSettlement_allocationId_key" ON "MiningSettlement"("allocationId");

CREATE UNIQUE INDEX "MiningSettlement_contractId_period_key" ON "MiningSettlement"("contractId", "period");

CREATE UNIQUE INDEX "DepositRequest_provider_reference_key" ON "DepositRequest"("provider", "reference");

CREATE INDEX "DepositRequest_userId_createdAt_idx" ON "DepositRequest"("userId", "createdAt");

CREATE INDEX "DepositRequest_status_createdAt_idx" ON "DepositRequest"("status", "createdAt");

CREATE UNIQUE INDEX "PaymentVerification_depositId_key" ON "PaymentVerification"("depositId");

CREATE UNIQUE INDEX "PaymentVerification_provider_settlementReference_key" ON "PaymentVerification"("provider", "settlementReference");

CREATE INDEX "WithdrawalRequest_userId_createdAt_idx" ON "WithdrawalRequest"("userId", "createdAt");

CREATE INDEX "WithdrawalRequest_status_createdAt_idx" ON "WithdrawalRequest"("status", "createdAt");

CREATE UNIQUE INDEX "WithdrawalSettlement_withdrawalId_key" ON "WithdrawalSettlement"("withdrawalId");

CREATE UNIQUE INDEX "WithdrawalSettlement_provider_settlementReference_key" ON "WithdrawalSettlement"("provider", "settlementReference");

CREATE UNIQUE INDEX "ReferralRelationship_referredId_key" ON "ReferralRelationship"("referredId");

CREATE UNIQUE INDEX "ReferralCommission_relationshipId_key" ON "ReferralCommission"("relationshipId");

CREATE UNIQUE INDEX "ReferralCommission_qualifyingDepositId_key" ON "ReferralCommission"("qualifyingDepositId");

CREATE UNIQUE INDEX "PromotionalCredit_userId_campaign_key" ON "PromotionalCredit"("userId", "campaign");

CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

CREATE INDEX "SupportTicket_userId_createdAt_idx" ON "SupportTicket"("userId", "createdAt");

CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

CREATE UNIQUE INDEX "IdempotencyKey_actorId_key_key" ON "IdempotencyKey"("actorId", "key");

CREATE INDEX "IdempotencyKey_createdAt_idx" ON "IdempotencyKey"("createdAt");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VerifiedContact" ADD CONSTRAINT "VerifiedContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TermsAcceptance" ADD CONSTRAINT "TermsAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RiskFlag" ADD CONSTRAINT "RiskFlag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WalletAccount" ADD CONSTRAINT "WalletAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WalletLedger" ADD CONSTRAINT "WalletLedger_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "WalletAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WalletLedger" ADD CONSTRAINT "WalletLedger_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "WalletLedger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WalletReservation" ADD CONSTRAINT "WalletReservation_withdrawalRequestId_fkey" FOREIGN KEY ("withdrawalRequestId") REFERENCES "WithdrawalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MachinePlan" ADD CONSTRAINT "MachinePlan_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "MiningOperation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MachineContract" ADD CONSTRAINT "MachineContract_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MachineContract" ADD CONSTRAINT "MachineContract_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MachinePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MachineContract" ADD CONSTRAINT "MachineContract_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "MiningOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MiningRevenue" ADD CONSTRAINT "MiningRevenue_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "MiningOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RevenueVerification" ADD CONSTRAINT "RevenueVerification_revenueId_fkey" FOREIGN KEY ("revenueId") REFERENCES "MiningRevenue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RewardAllocation" ADD CONSTRAINT "RewardAllocation_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "MachineContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RewardAllocation" ADD CONSTRAINT "RewardAllocation_revenueId_fkey" FOREIGN KEY ("revenueId") REFERENCES "MiningRevenue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RewardAllocation" ADD CONSTRAINT "RewardAllocation_reserveId_fkey" FOREIGN KEY ("reserveId") REFERENCES "PayoutReserve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MiningSettlement" ADD CONSTRAINT "MiningSettlement_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "MachineContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MiningSettlement" ADD CONSTRAINT "MiningSettlement_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "RewardAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DepositRequest" ADD CONSTRAINT "DepositRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentVerification" ADD CONSTRAINT "PaymentVerification_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES "DepositRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DepositHistory" ADD CONSTRAINT "DepositHistory_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES "DepositRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WithdrawalSettlement" ADD CONSTRAINT "WithdrawalSettlement_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "WithdrawalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WithdrawalHistory" ADD CONSTRAINT "WithdrawalHistory_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "WithdrawalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReferralRelationship" ADD CONSTRAINT "ReferralRelationship_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReferralRelationship" ADD CONSTRAINT "ReferralRelationship_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "ReferralRelationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_reserveId_fkey" FOREIGN KEY ("reserveId") REFERENCES "PayoutReserve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PromotionalCredit" ADD CONSTRAINT "PromotionalCredit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PromotionalCredit" ADD CONSTRAINT "PromotionalCredit_reserveId_fkey" FOREIGN KEY ("reserveId") REFERENCES "PayoutReserve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
