-- Run as migration owner in psql. Supply runtime_password interactively via \prompt.
-- Never commit the supplied password or paste it in chat.
\prompt -s 'New runtime database password: ' runtime_password
CREATE ROLE nextaka_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD :'runtime_password';
GRANT USAGE ON SCHEMA public TO nextaka_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nextaka_runtime;
REVOKE ALL ON TABLE "_prisma_migrations" FROM nextaka_runtime;
REVOKE UPDATE, DELETE ON "WalletLedger","AuditLog","PaymentVerification","RevenueVerification","MiningSettlement","WithdrawalSettlement","DepositHistory","WithdrawalHistory","ReferralCommission","PromotionalCredit","TermsAcceptance","IdempotencyKey" FROM nextaka_runtime;
REVOKE UPDATE, DELETE ON "WalletAccount" FROM nextaka_runtime;
DO $$ DECLARE row record; BEGIN
 FOR row IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations' LOOP
  EXECUTE format('CREATE POLICY runtime_server ON public.%I TO nextaka_runtime USING (true) WITH CHECK (true)',row.tablename);
 END LOOP;
END $$;
-- Backend role is trusted, NOT tenant RLS. Browser clients have no DB credentials.
-- Run migrations using the owner connection, runtime server using nextaka_runtime.
