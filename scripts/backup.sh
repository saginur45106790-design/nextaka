#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?Provide DATABASE_URL privately in this terminal}"
: "${BACKUP_OUTPUT:?Set a new absolute output path outside the repository}"
if [[ -e "$BACKUP_OUTPUT" ]]; then echo "Refusing to overwrite a backup." >&2; exit 1; fi
umask 077
pg_dump --format=custom --no-owner --no-acl --file="$BACKUP_OUTPUT" "$DATABASE_URL"
pg_restore --list "$BACKUP_OUTPUT" >/dev/null
printf '%s\n' 'Backup exported. Encrypt it, copy off-host, and verify a restore drill.'
