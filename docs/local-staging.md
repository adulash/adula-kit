# Local Docker staging

The owner selected this environment on 2026-09-22 (ADR 024). It runs the production
build without educational or medical modules. Ingress is `http://localhost:3345`,
bound to loopback. This is local HTTP, not public TLS or external capacity evidence.

The private deployment profile is `.work/local-staging/`. It contains generated
application/database credentials, isolated Compose overrides and the local
administrator credentials in `admin.json`. Never commit or publish that directory.
The administrator was created through the normal signup endpoint, then assigned
the bootstrap role with `adula:install`.

On the configured Windows/Ubuntu WSL host, run from the repository:

```powershell
wsl -d Ubuntu -- sh .work/local-staging/compose.sh ps
wsl -d Ubuntu -- sh .work/local-staging/compose.sh logs --tail 50 web worker scheduler
wsl -d Ubuntu -- sh .work/local-staging/compose.sh exec -T web node ace.js adula:doctor
```

Compose project `adula-kit-staging` owns separate PostgreSQL 17, Redis 7, upload,
backup and Caddy volumes. Database and Redis ports are not published. Only the
local Caddy port is published. Existing projects and their volumes are untouched.
Backup objects use a separate `adula/local-staging-20260922` prefix in the already
configured offsite store. Backup intervals and the monthly scheduler are unchanged.

The owner reports personally testing operations. A manually invoked restore with
`--allow-empty` verifies the initial core-only database, not a bound-file recovery
gate or natural monthly operation. Existing dated attachment tests remain separate.

Stop this environment without deleting its data:

```powershell
wsl -d Ubuntu -- sh .work/local-staging/compose.sh stop
```

Restart with `up -d`. Do not run `down --volumes` unless explicitly discarding this
environment and its data. Keep deployment secrets local; portable consumers use
their own generated deployment configuration and credentials.
