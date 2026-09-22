#!/bin/sh
set -eu
backup_once() {
  stamp=$(date -u +%Y-%m-%dT%H-%M-%SZ)
  directory="/backups/$stamp"
  # The command reads every attachment disk and publishes COMPLETE only after
  # downloading and verifying every offsite object. Failure stops retention too.
  node ace.js backup:create --snapshot="$directory" --prefix="${BACKUP_S3_PREFIX:-adula}/$stamp/"
  # Keep fourteen complete local snapshots. Failed snapshots have no COMPLETE marker.
  find /backups -mindepth 2 -maxdepth 2 -name COMPLETE | sort -r | tail -n +15 | while IFS= read -r marker; do
    snapshot=${marker%/COMPLETE}
    case "$snapshot" in /backups/20*) rm -rf -- "$snapshot" ;; *) exit 1 ;; esac
  done
  echo "Backup complete: $stamp"
}
backup_once
[ "${1:-}" = once ] && exit 0
while sleep 86400; do backup_once; done
