# ADR 007: Copied RTL components and independent installation

Status: implemented locally; full phase 2 visual acceptance remains open.

The backend configures an official AdonisJS 7 PostgreSQL consumer through official codemods. Configuration preserves project files and existing database settings. Module migration discovery uses stable relative paths and does not import domain models during configuration. Managed AGENTS boundaries and skill hashes are synchronized independently of project rules.

The UI package distributes 25 official shadcn source components, their MIT license and upstream source hashes. Adaptations use logical spacing, RTL defaults and Arabic controls. `adula:ui add` invokes the official CLI against a local registry bundle and records actual copied-file hashes. Existing customizations are refused before overwrite; `--preview` is non-mutating. Repeating core installation preserves already-installed UI.

Tailwind and legacy styles enter through one stylesheet to keep layer ordering deterministic. The reference app scopes starter styling to its original layout. The new business layout uses a local Noto Sans Arabic font, restrained green tokens and responsive navigation.

The theme uses Tailwind's documented `source(none)` and explicitly registers only the consumer's inertia directory. An independent nested consumer exposed unbounded source-discovery cost: its build exceeded 1.9 GB and was stopped; restricting discovery completed the same frontend build in 8.54 seconds. The consumer harness places an unused utility outside inertia and asserts that it does not enter the output, while copied component utilities do. Additional frontend directories require explicit sources; node_modules is not scanned. See [Tailwind source detection](https://tailwindcss.com/docs/detecting-classes-in-source-files#disabling-automatic-detection).

Acceptance evidence includes installing both tarballs into a separate starter application, 13 HTTP tests, customization preservation, module add/remove, typecheck and production build. This is an installation gate, not the required minor-version upgrade or offsite attachment-restore gate.
