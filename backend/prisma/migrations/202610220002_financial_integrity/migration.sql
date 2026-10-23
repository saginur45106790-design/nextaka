-- All monetary values are signed integer paisa. Session/database times are UTC.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
ALTER TABLE "User" ADD CONSTRAINT user_role CHECK (role IN ('USER','ADMIN')),
 ADD CONSTRAINT user_status CHECK (status IN ('ACTIVE','SUSPENDED','LOCKED')),
 ADD CONSTRAINT user_normalized_email CHECK (email = lower(btrim(email))),
 ADD CONSTRAINT verified_phone_consistent CHECK (("verifiedPhone" IS NULL AND "phoneVerifiedAt" IS NULL) OR ("verifiedPhone" IS NOT NULL AND "phoneVerifiedAt" IS NOT NULL AND "verifiedPhone" = phone));
ALTER TABLE "WalletAccount" ADD CONSTRAINT wallet_nonnegative CHECK ("balanceMinor" >= 0),
 ADD CONSTRAINT wallet_kind CHECK (kind IN ('MAIN','WITHDRAWAL','PROMOTIONAL','RESERVED'));
ALTER TABLE "WalletLedger" ADD CONSTRAINT ledger_nonzero CHECK ("amountMinor" <> 0),
 ADD CONSTRAINT ledger_balance_nonnegative CHECK ("balanceAfter" >= 0);
ALTER TABLE "WalletReservation" ADD CONSTRAINT reservation_positive CHECK ("amountMinor">0),
 ADD CONSTRAINT reservation_status CHECK(status IN ('HELD','PAID','RELEASED'));
ALTER TABLE "MachinePlan" ADD CONSTRAINT plan_amounts CHECK ("priceMinor">0 AND "dailyTargetMinor">0 AND "durationDays">0 AND "durationDays"<=365 AND "totalTargetMinor"="dailyTargetMinor"*"durationDays");
ALTER TABLE "MachineContract" ADD CONSTRAINT contract_amounts CHECK ("priceMinor">0 AND "dailyTargetMinor">0 AND "durationDays">0 AND "totalTargetMinor"="dailyTargetMinor"*"durationDays"),
 ADD CONSTRAINT contract_period CHECK ("endsAt">"startsAt"),
 ADD CONSTRAINT contract_status CHECK (status IN ('PURCHASE_PENDING','ACTIVE','REWARD_PENDING_VERIFICATION','REWARD_CREDITED','SUSPENDED','COMPLETED','CANCELLED','REFUNDED'));
ALTER TABLE "PayoutReserve" ADD CONSTRAINT reserve_amounts CHECK("fundedMinor">0 AND "availableMinor">=0 AND "availableMinor"<="fundedMinor"),
 ADD CONSTRAINT reserve_purpose CHECK(purpose IN ('MINING','REFERRAL','PROMOTION')),
 ADD CONSTRAINT reserve_source CHECK("sourceType" IN ('MINING_PROCEEDS','OWNER_CAPITAL','EARNED_FEES')),
 ADD CONSTRAINT reserve_verification CHECK(status <> 'VERIFIED' OR ("verifiedById" IS NOT NULL AND "verifiedAt" IS NOT NULL AND "verifiedById"<>"createdById"));
ALTER TABLE "MiningRevenue" ADD CONSTRAINT revenue_amounts CHECK("grossMinor">0 AND "operatingCostMinor">=0 AND "netMinor"="grossMinor"-"operatingCostMinor" AND "netMinor">=0 AND "allocatedMinor">=0 AND "allocatedMinor"<="netMinor"),
 ADD CONSTRAINT revenue_period CHECK("periodEndsAt">"periodStartsAt");
ALTER TABLE "RewardAllocation" ADD CONSTRAINT allocation_positive CHECK("amountMinor">0 AND period>0);
ALTER TABLE "MiningSettlement" ADD CONSTRAINT settlement_positive CHECK("amountMinor">0 AND period>0);
ALTER TABLE "DepositRequest" ADD CONSTRAINT deposit_positive CHECK("amountMinor">0),
 ADD CONSTRAINT deposit_status CHECK(status IN ('PENDING','UNDER_REVIEW','APPROVED','REJECTED','CANCELLED')),
 ADD CONSTRAINT deposit_provider CHECK(provider IN ('BKASH','NAGAD'));
ALTER TABLE "PaymentVerification" ADD CONSTRAINT payment_positive CHECK("amountMinor">0);
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT withdrawal_amounts CHECK("amountMinor">0 AND "feeMinor">=0 AND "feeMinor"<"amountMinor"),
 ADD CONSTRAINT withdrawal_status CHECK(status IN ('REQUESTED','UNDER_REVIEW','APPROVED','PROCESSING','PAID','REJECTED','CANCELLED')),
 ADD CONSTRAINT withdrawal_provider CHECK(provider IN ('BKASH','NAGAD'));
ALTER TABLE "ReferralRelationship" ADD CONSTRAINT no_self_referral CHECK("referrerId"<>"referredId");
ALTER TABLE "ReferralCommission" ADD CONSTRAINT commission_positive CHECK("amountMinor">0),
 ADD CONSTRAINT commission_deposit_fk FOREIGN KEY("qualifyingDepositId") REFERENCES "DepositRequest"(id);
ALTER TABLE "PromotionalCredit" ADD CONSTRAINT promotion_positive CHECK("amountMinor">0);
-- Exactly one lifetime welcome award. Campaign renaming cannot mint another award.
CREATE UNIQUE INDEX "PromotionalCredit_one_welcome_per_user" ON "PromotionalCredit"("userId");
CREATE OR REPLACE FUNCTION public.reject_history_change() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN RAISE EXCEPTION 'Historical records are immutable. Use an authorized compensating entry.' USING ERRCODE='23514'; END $$;
CREATE OR REPLACE FUNCTION public.guard_wallet_cache() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW."balanceMinor"<>0 THEN RAISE EXCEPTION 'Wallets must begin at zero' USING ERRCODE='23514'; END IF;
 ELSIF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Wallet deletion is forbidden' USING ERRCODE='23514';
 ELSIF NEW."userId"<>OLD."userId" OR NEW.kind<>OLD.kind OR NEW.id<>OLD.id OR (NEW."balanceMinor"<>OLD."balanceMinor" AND pg_trigger_depth()<2) THEN
  RAISE EXCEPTION 'Wallet balances are maintained by the ledger' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER wallet_cache_guard BEFORE INSERT OR UPDATE OR DELETE ON "WalletAccount" FOR EACH ROW EXECUTE FUNCTION public.guard_wallet_cache();
CREATE OR REPLACE FUNCTION public.post_ledger_entry() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE current_balance bigint; previous public."WalletLedger"%ROWTYPE;
BEGIN
 SELECT "balanceMinor" INTO STRICT current_balance FROM public."WalletAccount" WHERE id=NEW."accountId" FOR UPDATE;
 IF NEW."amountMinor"=0 OR current_balance+NEW."amountMinor"<0 THEN RAISE EXCEPTION 'Insufficient balance or zero entry' USING ERRCODE='23514'; END IF;
 IF NEW."reversalOfId" IS NOT NULL THEN
  SELECT * INTO STRICT previous FROM public."WalletLedger" WHERE id=NEW."reversalOfId";
  IF previous."accountId"<>NEW."accountId" OR previous."amountMinor"<>-NEW."amountMinor" THEN RAISE EXCEPTION 'Invalid compensating entry' USING ERRCODE='23514'; END IF;
 END IF;
 NEW."balanceAfter":=current_balance+NEW."amountMinor";
 NEW."createdAt":=CURRENT_TIMESTAMP;
 UPDATE public."WalletAccount" SET "balanceMinor"=NEW."balanceAfter" WHERE id=NEW."accountId";
 RETURN NEW;
END $$;
CREATE TRIGGER ledger_post BEFORE INSERT ON "WalletLedger" FOR EACH ROW EXECUTE FUNCTION public.post_ledger_entry();
DO $$ DECLARE table_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['WalletLedger','AuditLog','PaymentVerification','RevenueVerification','MiningSettlement','WithdrawalSettlement','DepositHistory','WithdrawalHistory','ReferralCommission','PromotionalCredit','TermsAcceptance','IdempotencyKey'] LOOP
  EXECUTE format('CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION public.reject_history_change()',table_name);
  EXECUTE format('CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION public.reject_history_change()',table_name);
 END LOOP;
END $$;
-- Sensitive tables are never exposed through a public database API. Express authenticates
-- and scopes every query. A trusted runtime role receives a named RLS policy below.
DO $$ DECLARE row record; BEGIN
 FOR row IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations' LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',row.tablename);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.post_ledger_entry() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_wallet_cache() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_history_change() FROM PUBLIC;

ALTER TABLE "WalletLedger" ADD CONSTRAINT "WalletLedger_actorId_user_fk" FOREIGN KEY ("actorId") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "MiningOperation" ADD CONSTRAINT "MiningOperation_createdById_user_fk" FOREIGN KEY ("createdById") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "MiningOperation" ADD CONSTRAINT "MiningOperation_verifiedById_user_fk" FOREIGN KEY ("verifiedById") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "PayoutReserve" ADD CONSTRAINT "PayoutReserve_createdById_user_fk" FOREIGN KEY ("createdById") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "PayoutReserve" ADD CONSTRAINT "PayoutReserve_verifiedById_user_fk" FOREIGN KEY ("verifiedById") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "MiningRevenue" ADD CONSTRAINT "MiningRevenue_createdById_user_fk" FOREIGN KEY ("createdById") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "RevenueVerification" ADD CONSTRAINT "RevenueVerification_verifiedById_user_fk" FOREIGN KEY ("verifiedById") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "RewardAllocation" ADD CONSTRAINT "RewardAllocation_approvedById_user_fk" FOREIGN KEY ("approvedById") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "DepositRequest" ADD CONSTRAINT "DepositRequest_reviewedById_user_fk" FOREIGN KEY ("reviewedById") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "PaymentVerification" ADD CONSTRAINT "PaymentVerification_verifiedById_user_fk" FOREIGN KEY ("verifiedById") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "DepositHistory" ADD CONSTRAINT "DepositHistory_actorId_user_fk" FOREIGN KEY ("actorId") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_reviewedById_user_fk" FOREIGN KEY ("reviewedById") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "WithdrawalSettlement" ADD CONSTRAINT "WithdrawalSettlement_settledById_user_fk" FOREIGN KEY ("settledById") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "WithdrawalHistory" ADD CONSTRAINT "WithdrawalHistory_actorId_user_fk" FOREIGN KEY ("actorId") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_reviewedById_user_fk" FOREIGN KEY ("reviewedById") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "PromotionalCredit" ADD CONSTRAINT "PromotionalCredit_reviewedById_user_fk" FOREIGN KEY ("reviewedById") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_repliedById_user_fk" FOREIGN KEY ("repliedById") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_user_fk" FOREIGN KEY ("createdById") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "SiteSetting" ADD CONSTRAINT "SiteSetting_updatedById_user_fk" FOREIGN KEY ("updatedById") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_user_fk" FOREIGN KEY ("actorId") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "ReconciliationRun" ADD CONSTRAINT "ReconciliationRun_createdById_user_fk" FOREIGN KEY ("createdById") REFERENCES "User"(id) ON DELETE RESTRICT;
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_actorId_user_fk" FOREIGN KEY ("actorId") REFERENCES "User"(id) ON DELETE RESTRICT;
