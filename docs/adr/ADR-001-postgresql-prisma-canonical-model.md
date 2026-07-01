# ADR-001: Use PostgreSQL with Prisma for the BAOS Canonical Data Model

## Status

Accepted

## Date

2026-06-30

## Context

BAOS requires a canonical data store for audit entities: organisations, users, audit programmes, controls, evidence items, findings, and workflow state. These entities are strongly relational — a finding references a control, which references a programme, which belongs to a tenant — and the integrity of those relationships is foundational to the audit trail.

We needed to choose a persistence layer before implementing any domain model. The constraints were:

- **Multi-tenant isolation** is a hard requirement at the data layer.
- **Schema strictness** matters because BAOS is certification-bound: schema drift is an audit risk in itself.
- **Evidence traceability** requires referential integrity that is enforced, not advisory.
- **Operational readiness**: the team already has a Neon (serverless PostgreSQL) instance provisioned and running in production.
- **ORM support**: Prisma was selected as the TypeScript ORM because it provides type-safe schema-first modelling, migration management, and first-class PostgreSQL support.
- A Knowledge Graph component (Neo4j) is planned for a later phase and must remain a separate concern.

## BAOS Principles Affected

- **Evidence-first** — Foreign-key constraints and ACID transactions ensure that every evidence item is durably linked to its parent conclusion path. A document-store without enforced references would allow orphaned evidence, which is inadmissible in an audit context.
- **Governance-first** — Prisma migrations produce a versioned, diff-able schema history. Every schema change is a commit — this is the governance record for the data layer itself.
- **Multi-tenant isolation** — Row-level tenant scoping is straightforward in a relational model (tenant_id column + RLS policies in PostgreSQL). Neon's branch-per-environment feature adds an additional isolation boundary for non-production workloads.
- **Security by design** — Neon supports TLS in transit, encryption at rest, and connection pooling via PgBouncer. Role-based access can be expressed at the database level, complementing application-layer RBAC.

## Decision

We adopt **PostgreSQL (hosted on Neon) as the canonical data store** for all BAOS domain entities, accessed exclusively through **Prisma ORM**.

Justification:

1. **Neon is already provisioned**: no additional infrastructure cost or onboarding burden. Using an already-running service eliminates a class of early-stage risk.
2. **Relational model fits the domain**: BAOS data is inherently tabular and referential. Audit programmes contain controls; controls contain evidence; evidence links to findings. These are foreign-key relationships, not flexible document bags.
3. **Prisma enforces schema discipline**: the `schema.prisma` file is the single source of truth for the data model. Type-safe generated client eliminates an entire category of runtime type errors. Migrations are explicit, reviewable, and reversible.
4. **PostgreSQL is certification-friendly**: its ACID guarantees, row-level security, and audit-logging extensions (e.g. `pgaudit`) make it a natural fit for compliance workloads.
5. **Neon branching**: enables ephemeral preview databases per pull request, supporting the governance principle that no change reaches production without a reviewed migration.

The Prisma schema will enforce:
- `tenantId` on every top-level entity.
- Cascade rules that preserve referential integrity on deletion.
- `createdAt` / `updatedAt` timestamps on all tables for the audit trail.

## Alternatives Considered

### MongoDB (document store)

MongoDB was evaluated as the primary canonical store. It was discarded for three reasons:

1. **No enforced schema**: BAOS entities have strict shapes. MongoDB's flexible schema is a feature in exploratory domains; in a certification context it is a liability — a document without a required field silently violates the data contract.
2. **No referential integrity**: cross-document references are application-enforced. A bug that orphans an evidence document is invisible at the database level.
3. **Prisma's MongoDB support is limited**: transactions are only available on replica sets, and some Prisma features (e.g. `@@unique` across relations) are unsupported. MongoDB may be reconsidered in the future for unstructured content blobs if a clear use case emerges.

### Neo4j (graph database)

Neo4j is the intended store for the BAOS Knowledge Graph component (risk taxonomies, control frameworks, cross-tenant pattern recognition). It was not chosen as the canonical store because:

1. **Graph databases are not canonical OLTP stores**: Cypher queries for transactional CRUD patterns are verbose and do not benefit from the graph model.
2. **Prisma has no Neo4j adapter**: using Neo4j as the canonical store would require a second ORM or raw driver, introducing inconsistency in the data access layer.
3. **Scope**: the Knowledge Graph is explicitly a Phase 2 component. Introducing Neo4j now would couple phases and complicate the initial data model.

Neo4j is **reserved** for the Knowledge Graph and will be addressed in a future ADR when that component is scoped.

## Consequences

### Positive

- Schema is versioned from day one; every migration is a traceable governance event.
- Type-safe Prisma client eliminates a class of runtime bugs in the application layer.
- Neon's serverless model means no idle compute cost in early development.
- PostgreSQL's native RLS can enforce tenant isolation at the database level as an additional safety net.
- Neon branching supports preview environments per PR with zero DBA overhead.

### Negative

- **Relational rigidity**: schema changes require migrations; adding a new optional field to an entity requires a reviewed migration rather than just adding a key. This is intentional but adds friction during rapid prototyping.
- **No full-text or vector search out of the box**: if BAOS later needs semantic search over evidence text, a separate extension (pgvector) or service will be required.
- **Neon vendor dependency**: while Neon is standard PostgreSQL, the branching and serverless features are Neon-specific. Migrating to self-hosted Postgres would lose those conveniences.

### Risks

- **Migration conflicts in parallel feature branches**: Prisma migrations can conflict if two branches add migrations concurrently. Mitigation: enforce a linear migration history policy — migrations are only authored on `main` or a dedicated `schema` branch, never on feature branches.
- **Neon connection limits**: serverless PostgreSQL has lower connection limits than dedicated instances. Mitigation: PgBouncer pooling is enabled on Neon by default; monitor connection usage as tenant count grows.

## BAOS Architecture Alignment

This decision is compatible with the frozen BAOS architecture:

- It implements the **Canonical Data Store** Core Component using a proven relational engine.
- It does not introduce autonomous learning, eliminate a human control point, or break multi-tenant isolation — it strengthens all three.
- It does not replace Neo4j for the Knowledge Graph; it defers that component explicitly.
- Prisma's migration system serves as the governance layer for data-model changes, consistent with the Governance-first principle.

No alignment concerns.

## Related ADRs

- *(none yet — future ADRs for the Knowledge Graph and evidence storage tiers will reference this decision)*
