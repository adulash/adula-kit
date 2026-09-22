# ADR 011: Application-owned contract fixtures and local acceptance checks

Status: implemented locally; release and operational gates remain separate.

Generated HTTP tests accept an explicit fixture callback instead of guessing valid business data. Each fixture supplies every form field, expected normalized public values, a valid update and any separate storage/inline expectations. Real users, roles and organizational memberships exercise the application's validators and PostgreSQL constraints. An out-of-scope assertion must first create and successfully read the record from an authorized account; a missing identifier alone cannot establish scope isolation. Central resources remain available to authorized users across organizational membership boundaries.

The copied helper verifies persisted scalar values, public serialization, child rows, updates, protected inputs, version conflicts, uniqueness and soft deletion. Generated tests are project-owned, as is the helper copied during configure. Existing helpers are never overwritten automatically. Changing an existing resource requires updating its fixture; missing expectations fail rather than silently omit coverage.

The kit's all-field service fixture tests custom column mappings, SQL projection, required/nullable values, JSON roots, canonical timestamps and rejected attachment writes with rollback. Sparse JavaScript arrays are rejected before persistence because JSON.stringify changes holes into null. This is not attachment upload support or a complete Tuyau contract.

Doctor measures local uploads at the existing deployment/backup path, storage/uploads, without reading file contents. It warns above 5 decimal GB or when it cannot completely measure the directory. Copied UI drift or a compatibility mismatch triggers a conservative inventory of project page sources; it does not claim import analysis or that an upgrade review has been performed.

Independent installation verification runs through Node on Windows or Linux. It pins the official starter revision, checks PostgreSQL 17, creates a dedicated *_test database and replaces inherited database environment variables for every consumer command. Local tarball installation, customization protection and production builds remain distinct from npm publication, a true minor-version upgrade, staging or record-plus-attachment restoration.
