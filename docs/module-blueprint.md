# Reference module blueprint

Historical design, superseded for application installation by [ADR 017](decisions/017-test-only-examples-and-release-gates.md). These modules now exist only as acceptance fixtures under `apps/reference/tests/fixtures`; the owner explicitly removed them from normal application operation. The implementation instructions below record the original foundation, not current authorization to restore them.

Reviewed against ADRs 001–004 and plan v4 before implementation.

* `customers`: central customer directory; one resource. No duplicate organizational tree or identity table.
* `orders`: depends on customers; scoped document with order lines, sequence, field permissions, lookup status, transactional lifecycle events.
* `tasks`: depends on orders; scoped task pointing to an order. Event listener integration belongs to the jobs acceptance work.
* Core owns users, roles, memberships, organizations, activities, settings, notifications and outbox.

Implement now: schemas, resource contracts, JSON endpoints and security tests. Declared extensions: hooks and transactional listeners. Later gates: full workflow engine, attachment pipeline, administrative UI and first independent production consumer. The user's request to execute the approved plan authorizes these reference modules.
