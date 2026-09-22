# adula-kit

Resource-driven business applications on AdonisJS 7, PostgreSQL 17 and React 19/Inertia. MIT.

**Current version: 0.2.0-alpha.1, unreleased. Target: the complete approved 1.0 scope.** The owner has reserved the `@adula` npm scope. The owner authorized an experimental `alpha` release through a reviewed PR and successful CI. `latest` and `next` remain blocked; this is not a completed 1.0. Local Docker staging is the selected runtime acceptance environment.

## Documentation

Start with the [documentation index](docs/README.md): [installation](docs/installation.md), [development](docs/development.md), [implementation status](docs/implementation-status.md), [remaining gaps](KIT_GAPS.md), [1.0 acceptance](docs/acceptance-1.0.md), and [release guide](docs/releasing.md).

## Packages and ownership

| Path | Purpose |
|---|---|
| `packages/kit` | `@adula/kit`: resource engine, CASL/SQL authorization, organizational scope, services, additive migrations and Ace commands. |
| `packages/ui` | `@adula/ui`: 25 shadcn primitives and nine resource components copied into the consuming project. |
| `packages/create-app` | `@adula/create-app`: create the application, install dependencies, provision local services and initialize the administrator in one command. |
| `apps/reference` | Integration application with authentication and core administration. Its normal registry contains no educational business modules. |
| `apps/reference/tests/fixtures` | Customers/orders/tasks and page overrides retained only as acceptance fixtures. |

The installed backend is updated as a package. Copied UI, pages, domain modules and branding notes belong to the application. Managed agent rules require the bundled business frontend-design skill, request company identity at kickoff, and default to shadcn Dialog for forms and row details unless the user requests another presentation.

## Installation in one command?

The new creator starts from an empty directory. After publication:

```sh
npm create @adula/app@alpha my-app
```

It installs AdonisJS and the kit, provisions PostgreSQL/Redis through Docker (or connects to existing services), migrates fresh databases, creates the administrator, installs shadcn/UI and managed skills, requests company identity, and builds the application. Node.js 24+, npm and, for the default mode, Docker Compose must already be installed. External SMTP/OAuth/S3 accounts require actual configuration. Until publication, use the local archives as described in the [installation guide](docs/installation.md).

`node ace adula:install` remains the initialization command **inside an existing AdonisJS application**; the standalone creator orchestrates the steps around it.

## Release boundary

`pnpm test:consumer` verifies kit/UI archives in an independent official starter. `pnpm test:create` verifies the packed creator from an empty directory through real administrator browser login. `pnpm check:release --artifacts=.work` verifies all three packages' exports, licensing, contents and checksums. These checks do not publish or assert 1.0 acceptance.

The prepared release workflow reruns CI and publishes the same tested archives through npm trusted publishing. Stable publication is blocked until every approved phase has dated acceptance evidence. See the [release guide](docs/releasing.md).
