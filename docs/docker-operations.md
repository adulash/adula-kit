# Docker operations on Windows and WSL

Docker Engine is installed in the Ubuntu WSL distribution on the verified development host. A missing `docker.exe` in Windows PATH does not mean Docker is unavailable. Use the existing engine:

```powershell
wsl -d Ubuntu -- docker version
wsl -d Ubuntu -- docker compose version
Get-PSDrive C | Select-Object Free,Used
```

Run Compose from the repository inside Ubuntu (`/mnt/c/...` for a Windows checkout). Keep application credentials in the deployment's untracked environment file. `docker compose config --quiet` validates interpolation without printing secrets.

The WSL virtual disk can report ample Linux free space while its Windows backing drive is full. Check both before builds. If the host fills up, stop building and free host space before retrying. Do not remove application volumes to resolve a build-cache problem.

## Image and runtime layout

The Dockerfile installs the pinned workspace lockfile before copying application sources, so code edits reuse the dependency layer. It builds the application and uses [pnpm deploy](https://pnpm.io/cli/deploy) to prepare a self-contained production dependency tree. The pinned pnpm legacy deployment retains workspace symlinks, so the Dockerfile replaces kit/UI links with their compiled packages and gives kit access to the production dependency store. A build-time realpath/import check rejects missing or external workspace targets. Only production dependencies and compiled application/workspace files enter the runtime image. File ownership is assigned during COPY; an expensive recursive ownership rewrite of the entire workspace is unnecessary.

Environment files, local work artifacts and browser inspection artifacts are excluded from the build context. Runtime dependencies include PostgreSQL 17 client tools and the AWS CLI. The application, worker and scheduler run as `node`; the backup service retains its dedicated volume access.

## Backup and recovery

`deploy/backup.sh` invokes the same `backup:create` command exercised by the source-S3 acceptance test. `BACKUP_S3_PREFIX` optionally selects a deployment or acceptance-test namespace, under `adula/`, without a trailing slash; its default is `adula`. The final object prefix is `<prefix>/<UTC timestamp>/`. Use distinct prefixes for independent deployments sharing a bucket.

The scheduler mounts `backups:/backups:ro` and retains writable uploads for isolated restore drills. The backup service reads uploads during capture; `docker-compose.restore.yml` replaces that mount with a writable mount at the same application path during recovery.

Run `make restore FILE=/backups/<UTC timestamp>` only against the selected deployment with its original disk configuration. The Makefile stops application services, verifies the snapshot before database recovery, restores attachment bytes and reconciles runtime state before reopening traffic. Failed recovery does not restart application services.

See [successful local Docker acceptance](evidence/docker-backup-2026-09-22.json). Container acceptance is recorded separately from staging, a natural daily/monthly timer firing, and production recovery. No public domain, external deployment or release acceptance follows from a successful local Docker run.

The hourly backup:verify command uses the same BACKUP_S3_PREFIX as backup creation and requires COMPLETE with the three payload/checksum objects in one recent snapshot. Objects under sibling or nested deployment prefixes cannot satisfy another deployment. Changing the prefix invalidates prior setup inspection evidence.
