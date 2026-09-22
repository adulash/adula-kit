# ADR 002: CASL authority and structural organizational scope

Status: accepted. Source: plan sections 6–7.

CASL 7 is the only authorization evaluator. Allow rules are ordered before all inverted rules. The SQL compiler implements CASE branches in CASL priority order and supports only $eq, $ne, $in, $lt, $gt and $like. Unknown operators and fields fail closed. Explicit null semantics use IS [NOT] DISTINCT FROM and COALESCE. Organizational scope is a separate AND restriction, never an allow rule.

Role assignment scope is intersected with user scope. Role-scoped grants do not grant central-resource access. Database revision triggers invalidate cached actors across workers and tree moves. Fields are selected internally, accepted from the form whitelist, and serialized through a separate whitelist plus record-specific CASL checks. Sorting and searching private fields is forbidden.

Relation conditions use foreign keys only. Nested relation predicates are rejected until a reviewed compiler supports them.
