# ADR-002: Use tenant_id Column for Multi-Tenant Isolation in Prisma

## Status

Accepted

## Date

2026-06-30

## Context

BAOS is a multi-tenant SaaS platform. Each tenant's data — audit conclusions, evidence, knowledge graph nodes, configuration, and session state — must be strictly isolated. No tenant may access, query, or infer data belonging to another tenant, even in the event of application-layer bugs.

Two primary isolation strategies exist at the database layer:

1. **Separate PostgreSQL schemas per tenant** — each tenant gets its own schema (e.g. `tenant_acme.conclusions`, `tenant_globex.conclusions`), enforcing isolation at the database level.
2. **Shared schema with a `tenant_id` discriminator column** — all tenants share the same tables; every row carries a `tenant_id` foreign key, and application-layer logic enforces isolation through query filters.

BAOS uses Prisma as its ORM for type-safe database access. Prisma's schema definition language (`schema.prisma`) generates static TypeScript types at build time. This code-generation model assumes a fixed, known schema. Prisma does not support dynamic schema selection at runtime (switching the search path per request) in a way that preserves generated types and the full safety guarantees of the ORM. Achieving per-tenant schemas with Prisma would require either: (a) bypassing the ORM with raw SQL for tenant-scoped operations, losing type-safety entirely; or (b) generating a separate Prisma client per tenant, which is operationally impractical at scale.

BAOS's governance requirements mandate that all data access is auditable and traceable through typed, versioned application code. Bypassing the ORM for isolation logic would undermine this requirement.

## BAOS Principles Affected

- **Multi-tenant isolation** — This decision directly implements the core data-layer isolation boundary between tenants. The chosen approach moves enforcement from the database schema level to the application query level, which introduces an application-layer risk (missing filter) that must be mitigated by a validation middleware.
- **Security by design** — Isolation is a security property. The approach must be hardened so that a missing `tenant_id` filter is caught before it reaches the database, not discovered post-incident.
- **Governance-first** — All query patterns touching tenant-scoped data must be version-controlled and reviewable. A shared schema with a mandatory discriminator column keeps all data access in typed Prisma queries, which are auditable in the codebase.
- **Evidence-first** — Evidence records are among the most sensitive tenant-scoped data. Isolation failures here would be a critical breach. The middleware validation applies uniformly to all models, including evidence tables.

## Decision

**Use a `tenant_id` column on every Prisma model that holds tenant-scoped data, and enforce mandatory filtering via a Prisma middleware (query interceptor) that validates the presence of `tenant_id` in every query against tenant-scoped models.**

Rationale:

- Prisma's type-safe code generation is a BAOS architecture asset. Abandoning it to enable per-schema routing would trade a known security guarantee (typed queries) for a different isolation approach without net benefit.
- A shared-schema model is operationally simpler: schema migrations apply once, not N times per tenant. This matters as BAOS scales to many tenants.
- The isolation risk introduced by application-layer filtering is real but tractable: a Prisma middleware that intercepts every `findMany`, `findFirst`, `findUnique`, `update`, `delete`, and `upsert` call can assert that `where.tenant_id` is present before the query reaches the database. This turns a runtime data-leak risk into a build-time/startup detectable error.
- Prisma middleware is the idiomatic extension point for cross-cutting query concerns. It runs synchronously before query execution and can throw, preventing the query from executing.

Every Prisma model that holds tenant-scoped data will include:

```prisma
model ExampleModel {
  id        String  @id @default(cuid())
  tenant_id String
  // ... other fields
  tenant    Tenant  @relation(fields: [tenant_id], references: [id])

  @@index([tenant_id])
}
```

The validation middleware will be registered globally on the Prisma client instance and will enforce `tenant_id` presence on all write and read operations for tenant-scoped models.

## Alternatives Considered

### Separate PostgreSQL Schemas per Tenant

Each tenant is assigned a dedicated PostgreSQL schema (`SET search_path = tenant_<id>`). Tables are identical across schemas; the database engine enforces isolation at the schema boundary.

**Discarded because**: Prisma generates a single static client from `schema.prisma`. Switching schemas at runtime requires either raw SQL (`SET search_path`) or per-tenant Prisma client instances. The former bypasses the ORM's type system entirely; the latter requires generating and loading N Prisma clients (one per tenant) at startup or on-demand, which is operationally untenable and increases cold-start latency. Neither approach is compatible with BAOS's requirement for fully typed, auditable database access through the ORM.

### Row-Level Security (RLS) via PostgreSQL Policies

Enable PostgreSQL RLS on each table with a policy that checks `current_setting('app.tenant_id')` against the row's `tenant_id`. The application sets this session variable on each connection before executing queries.

**Discarded because**: RLS enforcement is invisible at the application layer — developers writing Prisma queries get no compile-time or runtime feedback that they are operating in tenant context. Session variable management with connection pooling (e.g. PgBouncer in transaction mode) is fragile: session variables do not persist across pooled connections in transaction mode, requiring explicit re-setting on every transaction, which is error-prone. RLS can be added as a defense-in-depth layer in the future, but should not be the primary enforcement mechanism.

### Separate Database Instances per Tenant

Each tenant gets an entirely separate PostgreSQL instance or database.

**Discarded because**: Operationally prohibitive at BAOS's intended scale. Schema migrations, monitoring, backup, and connection management multiply linearly with tenant count. This approach is appropriate only for very-high-value, low-count enterprise tenants (e.g. government contracts requiring physical data separation), which is a future concern addressed by a separate deployment tier decision, not this ADR.

## Consequences

### Positive
- Prisma type-safety is fully preserved across all tenant-scoped queries.
- Schema migrations are applied once, simplifying the operational runbook.
- `tenant_id` is visible and explicit in every query, making tenant scoping auditable in code review and in the audit log.
- The middleware enforcement layer is a single, testable component that can be exhaustively unit-tested.
- Adding a new tenant requires only a new row in the `Tenant` table — no schema provisioning step.

### Negative
- Every tenant-scoped table carries a `tenant_id` column and index, increasing storage and index overhead proportional to tenant count (acceptable trade-off at expected scale).
- Application developers must be aware of the `tenant_id` contract and write queries that include it, or the middleware will block execution (intentional, but adds a learning curve for new contributors).
- Bulk cross-tenant analytics queries (e.g. platform-level reporting) cannot omit the `tenant_id` filter by default; a separate privileged Prisma client or raw query path must be designated for platform-level operations, with explicit bypass justification.

### Risks
- **Cross-tenant data leak via missing filter**: A query that omits `tenant_id` in its `where` clause will return data across tenants. **Mitigation**: The Prisma middleware is the primary control. It must be registered before any query is executed and must cover all tenant-scoped models. The middleware itself must be tested with integration tests that assert filtered and unfiltered queries behave correctly. A future ADR will define the middleware's exact contract and test coverage requirements.
- **Middleware bypass via `$queryRaw`**: Prisma's `$queryRaw` API bypasses the middleware. Any use of `$queryRaw` on tenant-scoped data must be explicitly reviewed and prohibited by lint rule or code review policy. This is a known escape hatch that must be governed.
- **Connection pool session variable leakage (if RLS is added later)**: If PostgreSQL RLS is added as defense-in-depth, session variable management must account for connection pooling behavior. This is a future risk, not an immediate one.

## BAOS Architecture Alignment

This decision implements the **Multi-tenant isolation** Core Component requirement at the data layer. It does not redesign or replace any Core Component — it specifies how the shared-schema pattern materialises the isolation boundary that the frozen architecture requires.

The Prisma middleware validation layer is a new application-layer component introduced by this decision. It must be treated as a security-critical component: changes to it require review, it must have test coverage, and its bypass (via `$queryRaw`) must be governed.

No frozen architecture constraints are violated. Human control points are not affected. Evidence traceability is strengthened (tenant context is explicit in all query traces).

## Related ADRs

- ADR-001: (existing) — relates to foundational BAOS data layer choices that this decision builds upon.
