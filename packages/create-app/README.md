# @adula/create-app

Creates a complete, project-owned AdonisJS 7 application with adula, React/Inertia,
shadcn/ui, authentication, administration and the managed business-design skill.
Version 0.2.0-alpha.1 is **unreleased**; registry commands become available after publication.

```sh
npm create @adula/app@alpha my-app
```

Requires Node.js 24+ and npm. The default provisions PostgreSQL 17 and Redis 7
through an existing Docker installation with Compose. pnpm is bootstrapped through
npm and installed as a project-local development dependency; neither a global
pnpm installation nor a pre-existing AdonisJS application is required.

The wizard requests the company name, administrator email and company identity.
An optional identity JSON file contains `primaryColor` (six-digit hex), `logo`
(local PNG/JPEG/WebP path relative to the JSON), `fontFamily` and `guidelines`.
Known identity is applied immediately. Missing identity remains explicitly pending
in `docs/design-identity.md`; no official branding is invented.

Terminal prompts and errors use English so they remain readable in terminals
without Arabic shaping. The application stays Arabic. Installation shows six real
stages, with color and a spinner in interactive terminals. `NO_COLOR=1`, redirected
output and dumb terminals use plain progress lines. Detailed child-command output
is retained privately in ignored `tmp/install.log`; failures identify that log.

```sh
npm create @adula/app@alpha my-app -- --company "My company" --admin-email admin@example.com --identity ./brand.json --yes
```

For existing services, add `--services existing --connection ./local.json`:

```json
{
  "postgres": {
    "host": "127.0.0.1",
    "port": 5432,
    "user": "adula",
    "password": "YOUR_LOCAL_PASSWORD"
  },
  "redis": { "host": "127.0.0.1", "port": 6379 }
}
```

Keep this file private. The PostgreSQL role needs `CREATEDB`; the command creates
fresh development/test databases. It refuses an existing destination directory
with content or a pre-existing database. Database failures preserve files/data
for inspection. Local administrator credentials are saved in ignored
`tmp/dev-admin.txt`, never printed. No educational business modules are installed.
An optional `--database name` selects a fresh database name (lowercase letters,
digits and underscores, at most 50 characters); an existing name is still refused.
Values containing dotenv interpolation or quote characters are stored in private
`tmp/env` files and loaded through AdonisJS's `file:` identifier without alteration.

After creation: `cd my-app` and `npm run dev`. Workers and scheduler are separate
runtime processes documented in the application README. SMTP, OAuth, S3, production
hosting and off-site backups need real configuration; no external accounts are
created. Node.js and Docker themselves are host prerequisites.

Before publication, run the packed CLI with npm exec and `--packages` pointing
to the directory containing matching `adula-kit-VERSION.tgz` and
`adula-ui-VERSION.tgz`. `pnpm test:create` exercises this path from an empty folder.
