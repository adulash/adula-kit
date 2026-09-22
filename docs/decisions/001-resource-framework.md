# ADR 001: AdonisJS 7 and a modular monolith

Status: accepted. Source: adula-kit-plan.md v4, sections 2–5.

Use the official AdonisJS 7 React starter and package starter in a pnpm workspace. The kit owns infrastructure; each application owns domain modules, migrations and copied UI. Resource definitions are TypeScript with mandatory bilingual labels and explicit organizational scope. One deployment belongs to one organization; the ltree hierarchy is not a tenant boundary.

No dynamic field designer, runtime plugin loader, separate per-module apps or alternative framework. MIT applies to every package. Production targets Node 24 and PostgreSQL 17.
