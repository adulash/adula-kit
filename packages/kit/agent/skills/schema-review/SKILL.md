---
name: schema-review
description: Review migrations and resource definitions for integrity and evolution.
---

Check, citing file and line:

- Migrations are additive (expand/contract): no drop or rename of a column still
  read by the previous release; kit migrations are never edited after release.
- Standard columns come from the generator (`id`, `org_unit_id` when scoped,
  `created_by`, `updated_by`, timestamps, `deleted_at`, `version`, `doc_status`,
  `amended_from_id`); they are not hand-edited.
- Every foreign key is indexed and `restrict` on delete (cascade only inside the
  same module); `(org_unit_id, deleted_at)` exists for scoped tables.
- Unique rules are partial (`WHERE deleted_at IS NULL`); searchable fields produce
  the generated tsvector with a GIN index.
- Money is bigint minor units; dates use `date`, instants `timestamptz`; changeable
  lists are lookups, numbering uses sequences.
- The definition's `form`, `list`, `show` and `serialize` match the columns, and
  generated contract tests cover 403/404/uniqueness/scope.

Verdict: accept, or blocking findings with the corrected migration.
