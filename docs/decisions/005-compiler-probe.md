# ADR 005: Explicit condition compiler after the isolated spike

Status: accepted on 2026-09-17. Evidence: docs/evidence/authorization-probes.json.

@ucast/sql 0.2.0 was run against PostgreSQL with equality to NULL, inequality, membership including NULL and LIKE. Its default translation differs from the kit's explicit NULL contract, and LIKE has no default interpreter. Use the small explicit compiler and retain the SQL-versus-CASL parity suite as the acceptance criterion.

The ltree probe inserted 100,000 temporary rows, created a GiST index, ran ANALYZE and EXPLAIN (ANALYZE, BUFFERS). PostgreSQL chose a bitmap index scan. This is a local feasibility measurement, not the k6 performance acceptance test.
