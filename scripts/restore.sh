#!/usr/bin/env bash
set -euo pipefail
: "${RESTORE_DATABASE_URL:?Set a separate, empty restore database URL}"
: "${BACKUP_INPUT:?Set the path to the encrypted-off-host backup after local decryption}"
: "${RESTORE_CONFIRMATION:?Set RESTORE_CONFIRMATION=EMPTY_ISOLATED_DATABASE}"
[[ "$RESTORE_CONFIRMATION" == "EMPTY_ISOLATED_DATABASE" ]] || exit 1
[[ -f "$BACKUP_INPUT" ]] || exit 1
count=$(psql "$RESTORE_DATABASE_URL" -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='public'")
[[ "$count" -eq 0 ]] || { echo 'Restore destination must be empty.' >&2; exit 1; }
pg_restore --exit-on-error --no-owner --no-acl --dbname="$RESTORE_DATABASE_URL" "$BACKUP_INPUT"
printf '%s\n' 'Restored. Run reconciliation and application tests before any service cutover.'
