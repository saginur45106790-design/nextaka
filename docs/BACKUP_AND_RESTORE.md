# Backup and restore

Render Free PostgreSQL expires after 30 days and has no managed backups. Do not use it for financial custody. A local manual dump is not equivalent to a monitored production backup programme.

## Before any migration

1. Keep financial gates closed. Record deployed commit and current migration status.
2. From a trusted machine with PostgreSQL client, set DATABASE_URL privately and BACKUP_OUTPUT to a new absolute path outside this repository.
3. Run `bash scripts/backup.sh`. Do not commit the dump. Encrypt it and store a copy away from the database/host with separate access controls.
4. Verify dump checksum and `pg_restore --list`. A readable list is not proof of a successful restore.

## Restore drill

Create a separate empty PostgreSQL instance. Set RESTORE_DATABASE_URL, BACKUP_INPUT and RESTORE_CONFIRMATION=EMPTY_ISOLATED_DATABASE privately. Run `bash scripts/restore.sh`. The script refuses a non-empty public schema and does not use --clean.

Run migration status, user count, wallet-ledger reconciliation, reserve-allocation reconciliation and auth/security smoke tests on the restored instance. Check provider settlement references against independently held records. Record restore time, recovery point, discrepancies, operator and evidence.

Only then plan a reviewed cutover. Never point a restored test instance at real payment infrastructure during a drill. Keep both old and new production environments from settling simultaneously until the cutover is complete.

Paid Render Postgres supports recovery features subject to plan/current terms. Confirm retention and actual restore functionality in the Render dashboard. Define RPO/RTO and off-host retention according to legal obligations. Admin backup screen deliberately says NOT_VERIFIED until independently attested; it does not poll or fabricate Render backups.

References: https://render.com/docs/free and https://render.com/docs/postgresql-backups
