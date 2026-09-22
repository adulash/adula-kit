#!/bin/sh
set -eu
directory=${1:?A backup directory is required}
case "$directory" in /backups/20*) ;; *) echo 'Only backup volume snapshots may be restored' >&2; exit 1 ;; esac
[ -f "$directory/COMPLETE" ] || { echo 'Incomplete snapshot' >&2; exit 1; }
node ace.js backup:verify-snapshot --snapshot="$directory"
export PGHOST="$DB_HOST" PGPORT="${DB_PORT:-5432}" PGUSER="$DB_USER" PGPASSWORD="$DB_PASSWORD" PGDATABASE="$DB_DATABASE"
pg_restore --clean --if-exists --no-owner --exit-on-error --dbname="$DB_DATABASE" "$directory/database.dump"
if [ -f "$directory/attachments.json" ]; then
  node ace.js backup:restore-files --snapshot="$directory" --apply
else
  # Compatibility for pre-manifest snapshots, which contain local files only.
  [ "${DRIVE_DISK:-local}" = local ] || { echo 'Legacy snapshot does not contain S3 attachments' >&2; exit 1; }
  tar -xzf "$directory/uploads.tar.gz" -C /app/apps/reference/storage/uploads
fi
echo 'Database and uploads restored. Run the record-and-attachment acceptance check before reopening traffic.'
