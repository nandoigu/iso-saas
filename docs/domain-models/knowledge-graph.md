# Domain Model: Knowledge Graph

> BAOS Component: Knowledge Graph
> Phase: Phase 3 — Knowledge Layer Implementation (planned from Phase 1 Foundation baseline)
> Date: 2026-06-30
> Status: Draft

---

## Conceptual Model

The Knowledge Graph is the normative backbone of BAOS. It stores the structured, versioned content of ISO standards (and related normative documents) so that the Rule Engine, Requirement Graph, and Audit Runtime can reason over precise clauses rather than free text.

**KnowledgeSource** is a standard family — a body of normative work published by a standards organisation (e.g., "ISO 19650" published by ISO). One source can have multiple published editions.

**KnowledgeRelease** is a specific published edition of a standard or part thereof — for example, "ISO 19650-1:2018" or "ISO 19650-2:2021". A release is the unit of versioning: when ISO publishes a new edition, a new KnowledgeRelease is created and linked to the previous one it supersedes. Releases are immutable once set to `active`.

**KnowledgeNode** is a single knowledge element within a release: a section header, a numbered clause, a normative requirement, a defined term, a note, or an annex. Nodes are arranged in a parent-child hierarchy that mirrors the standard's structure (e.g., clause 5 → clause 5.2 → clause 5.2.1). Nodes can be superseded individually when a new release revises a specific clause, even if other clauses remain unchanged.

**KnowledgeNodeVersion** records every content change to a node. It captures a full snapshot of the node's state at the moment of the change, who made it, why, and what kind of change it was (initial capture, content correction, status change). This follows the same pattern as AuditReport / AuditReportVersion already in the system.

**KnowledgeEdge** represents a directed semantic relationship between two knowledge nodes. The edge type captures the meaning: a requirement *depends on* a definition, one clause *specializes* a more general clause, two requirements *contradict* each other, a note *clarifies* a normative statement. Edges may connect nodes within the same release or across releases (e.g., tracing how a 2023 clause specialises a 2018 clause).

Together, these five entities form a versioned, traversable graph that lets BAOS answer questions like: "What does clause 5.2.1 of ISO 19650-1:2018 require, and does the 2023 edition change that requirement?"

---

## Entities and Responsibilities

| Entity | What it represents | Key attributes |
|--------|-------------------|----------------|
| `KnowledgeSource` | A standard family (e.g., ISO 19650, BS EN 17412) | code, name, domain, publishingBody |
| `KnowledgeRelease` | A specific published edition of a standard or part (e.g., ISO 19650-1:2018) | part, edition, status, effectiveDate, supersedingId |
| `KnowledgeNode` | A single knowledge element: clause, requirement, definition, note, annex | type, code, title, content, level, parentId, contentVersion, status, supersededByNodeId |
| `KnowledgeNodeVersion` | Immutable snapshot of a node's state at a given version | version, snapshot (JSON), changeType, changeNote |
| `KnowledgeEdge` | Directed semantic relationship between two nodes | type, sourceNodeId, targetNodeId, description, isActive |

---

## Entity Relationships

```
KnowledgeSource (1) ──── (N) KnowledgeRelease
                                    │
                         supersedes/supersededBy (self-ref)
                                    │
                              (1) ──── (N) KnowledgeNode
                                              │
                                    parent/children (self-ref)
                                              │
                                    supersedes/supersededBy (self-ref)
                                              │
                                    ┌─────────┴──────────┐
                              (N) KnowledgeNodeVersion   (N) KnowledgeEdge
                                                          (sourceNode / targetNode)
```

**Cardinalities:**
- KnowledgeSource → KnowledgeRelease: 1-to-N
- KnowledgeRelease → KnowledgeRelease (supersession): 0-to-1 (linear chain)
- KnowledgeRelease → KnowledgeNode: 1-to-N
- KnowledgeNode → KnowledgeNode (hierarchy): 0-to-N children
- KnowledgeNode → KnowledgeNode (supersession): 0-to-1 forward link
- KnowledgeNode → KnowledgeNodeVersion: 1-to-N
- KnowledgeNode → KnowledgeEdge (as source): 0-to-N
- KnowledgeNode → KnowledgeEdge (as target): 0-to-N

---

## Prisma Schema

```prisma
// ─── Knowledge Graph ────────────────────────────────────────────────────────
// Global normative corpus — not tenant-scoped (see Integration Notes for rationale).
// Admin-managed. Tenants consume but do not own this data.

model KnowledgeSource {
  id            String   @id @default(cuid())
  code          String   @unique  // "ISO 19650", "BS EN 17412", "PAS 1192-2"
  name          String            // "Building information modelling — Organization..."
  description   String?
  domain        String            // "BIM", "Construction", "FM", "Infrastructure"
  publishingBody String           // "ISO", "BSI", "CEN", "AENOR"
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  createdBy     String            // userId of BAOS admin who registered this source

  releases      KnowledgeRelease[]

  @@index([domain])
  @@index([isActive])
}

model KnowledgeRelease {
  id             String    @id @default(cuid())
  sourceId       String
  part           String?             // "1", "2", "3" — null for single-part standards
  edition        String              // "2018", "2021", "2023"
  title          String              // Full title of this part/edition
  status         String    @default("draft")
  // draft | active | superseded | withdrawn
  // Only one release per source+part should be "active" at a time (enforced in service layer)
  effectiveDate  DateTime?           // Date this edition came into force
  withdrawalDate DateTime?           // Date this edition was formally withdrawn
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  createdBy      String

  source         KnowledgeSource   @relation(fields: [sourceId], references: [id], onDelete: Restrict)

  // Supersession chain: this release supersedes an older one
  // "supersedingId" points to the NEWER release that replaced this one (null if this is current)
  supersedingId  String?
  supersededBy   KnowledgeRelease?  @relation("ReleaseSupersession", fields: [supersedingId], references: [id])
  supersedes     KnowledgeRelease[] @relation("ReleaseSupersession")

  nodes          KnowledgeNode[]

  @@unique([sourceId, part, edition])
  @@index([sourceId])
  @@index([status])
}

model KnowledgeNode {
  id                 String   @id @default(cuid())
  releaseId          String
  type               String
  // clause | requirement | definition | note | example | annex | informative_annex
  code               String              // "3.1.1", "5.2", "A.1" — unique within a release
  title              String?             // Short heading (e.g., "Appointment")
  content            String              // Full normative text of this element
  level              Int                 // Depth: 1=section, 2=clause, 3=sub-clause, 4=paragraph
  contentVersion     Int      @default(1)  // Incremented on every content change
  status             String   @default("active")
  // active | deprecated | superseded
  parentId           String?             // Self-ref: parent clause in hierarchy
  supersededByNodeId String?             // Points to the node in a newer release that replaces this one

  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  createdBy          String

  release            KnowledgeRelease  @relation(fields: [releaseId], references: [id], onDelete: Restrict)

  parent             KnowledgeNode?    @relation("NodeHierarchy", fields: [parentId], references: [id])
  children           KnowledgeNode[]   @relation("NodeHierarchy")

  supersededBy       KnowledgeNode?    @relation("NodeSupersession", fields: [supersededByNodeId], references: [id])
  supersedes         KnowledgeNode[]   @relation("NodeSupersession")

  versions           KnowledgeNodeVersion[]
  outgoingEdges      KnowledgeEdge[]   @relation("EdgeSource")
  incomingEdges      KnowledgeEdge[]   @relation("EdgeTarget")

  @@unique([releaseId, code])
  @@index([releaseId])
  @@index([type])
  @@index([parentId])
  @@index([status])
}

model KnowledgeNodeVersion {
  id          String   @id @default(cuid())
  nodeId      String
  version     Int                 // Matches KnowledgeNode.contentVersion at time of snapshot
  snapshot    Json                // Full node state at this version (type, code, title, content, status, level)
  changeType  String
  // initial | content_update | status_change | correction | import
  changeNote  String?             // Human-readable explanation of what changed and why
  createdAt   DateTime @default(now())
  createdBy   String

  node        KnowledgeNode @relation(fields: [nodeId], references: [id], onDelete: Cascade)

  @@unique([nodeId, version])
  @@index([nodeId])
  @@index([createdBy])
}

model KnowledgeEdge {
  id             String   @id @default(cuid())
  sourceNodeId   String
  targetNodeId   String
  type           String
  // depends_on    — source cannot be satisfied without target
  // contradicts   — source and target conflict (triggers ContradictionEngine)
  // specializes   — source is a specific case of the more general target
  // references    — source cites or points to target without semantic dependency
  // implements    — source operationalises the principle stated in target
  // clarifies     — source provides normative clarification of target (often note→clause)
  description    String?  // Why this relationship exists (governance trail)
  isActive       Boolean  @default(true)  // Deactivated rather than deleted when a relationship lapses
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  createdBy      String

  sourceNode     KnowledgeNode @relation("EdgeSource", fields: [sourceNodeId], references: [id], onDelete: Restrict)
  targetNode     KnowledgeNode @relation("EdgeTarget", fields: [targetNodeId], references: [id], onDelete: Restrict)

  @@unique([sourceNodeId, targetNodeId, type])
  @@index([sourceNodeId])
  @@index([targetNodeId])
  @@index([type])
  @@index([isActive])
}
```

---

## BAOS Compliance Checklist

- [x] All top-level entities have `createdAt` and `updatedAt` (audit trail)
- [x] All entities have `createdBy` — admin user id for governance trail
- [x] Cascade delete rules explicitly defined for all relations:
  - KnowledgeSource → KnowledgeRelease: `onDelete: Restrict` (cannot delete source with releases)
  - KnowledgeRelease → KnowledgeNode: `onDelete: Restrict` (cannot delete release with nodes)
  - KnowledgeNode → KnowledgeNodeVersion: `onDelete: Cascade` (versions go with the node)
  - KnowledgeEdge → KnowledgeNode: `onDelete: Restrict` (cannot delete a node referenced by edges)
- [x] Mutable state creates version records — KnowledgeNodeVersion snapshots every change
- [x] No autonomous decision fields — graph content is authored/approved by BAOS admin, not auto-generated
- [x] Sensitive fields documented — none in this model (normative text is public domain)
- [ ] `tenantId` on top-level entities — **intentional exception** (see rationale below)

**Multi-tenant rationale**: The normative knowledge corpus (ISO 19650 text) is global shared reference data, not tenant-owned data. It follows the same pattern as `RequirementTemplate` in the existing schema, which also has no `tenantId`. Tenants consume the Knowledge Graph but do not own it. Tenant-specific knowledge extensions (custom annotations, jurisdictional interpretations) belong in a future `KnowledgeAnnotation` model with `tenantId`.

---

## Invariants and Business Rules

1. A `KnowledgeNode` cannot be deleted if any `KnowledgeEdge` references it as source or target. Use `status: deprecated` or `status: superseded` instead.

2. A `KnowledgeRelease` cannot be deleted if it contains `KnowledgeNode` records. Releases are append-only once created.

3. Only one `KnowledgeRelease` per `(sourceId, part)` combination should have `status: active` at any time. The service layer enforces this when activating a release.

4. When a `KnowledgeRelease` is activated and supersedes an older one, the older release's `supersedingId` must be set and its `status` changed to `superseded` atomically.

5. Every content change to a `KnowledgeNode` must create a `KnowledgeNodeVersion` record first, then increment `contentVersion`. The version record is the source of truth for history — the node itself holds the current state only.

6. `contentVersion` numbers are monotonically increasing and never reused. A correction that reverts content still creates a new version number.

7. A `KnowledgeEdge` with `type: contradicts` must trigger a record in the `ContradictionEngine` (future component) for resolution tracking.

8. `KnowledgeEdge.sourceNodeId` must not equal `targetNodeId` — no self-referential semantic edges (self-referential hierarchy is handled by `KnowledgeNode.parentId`).

9. A `KnowledgeNode` with `status: superseded` must have `supersededByNodeId` set. A node cannot be marked superseded without pointing to its replacement.

---

## Integration with Existing Schema

### RequirementTemplate → KnowledgeNode

The existing `RequirementTemplate` model has `norma` and `item` fields (e.g., `norma: "ISO 19650-2"`, `item: "5.2.1"`). These are currently free-text strings. The future integration path:

1. Add optional `knowledgeNodeId String?` to `RequirementTemplate`.
2. This FK links the template to the exact KnowledgeNode it derives from.
3. Migration: populate `knowledgeNodeId` by matching `(norma, item)` against `(KnowledgeRelease.source.code + KnowledgeRelease.part, KnowledgeNode.code)`.
4. **No migration needed now** — the FK is optional and additive.

### Requirement → KnowledgeNode (future)

Individual `Requirement` records (per project) will eventually carry a reference to the `KnowledgeNode` they implement. This enables the Evidence Graph to trace: evidence → requirement → knowledge node.

Planned addition to `Requirement`: `knowledgeNodeId String?`

### AuditReport → KnowledgeRelease (future)

`AuditReport` will need a `knowledgeReleaseId` field to record which edition of the standard was current at audit time. This ensures historical reports remain valid even after the standard is updated.

Planned addition to `AuditReport`: `knowledgeReleaseId String?`

### No existing migrations required today

All connections listed above use optional FK fields. The Knowledge Graph models can be added as a new migration without modifying any existing table columns.

---

## Open Questions

1. **Jurisdictional variants**: ISO 19650 has national adaptations (e.g., BS EN ISO 19650 in UK, UNE EN ISO 19650 in Spain). Should these be separate `KnowledgeSources` or treated as `KnowledgeRelease` variants within the same source? Recommendation: separate sources with cross-source edges of type `specializes`.

2. **Import format**: What is the authoritative import format for ingesting normative text? Candidate formats: structured XML (ISO STS), PDF with parsed sections, manual authoring. The ingestion pipeline belongs in the Training Factory / Knowledge Acquisition component (Phase 11).

3. **Access control for knowledge graph authoring**: Who can create/modify KnowledgeSource, KnowledgeRelease, and KnowledgeNode records? Proposed: BAOS super-admin role only (above the existing `admin` role). This role distinction is not yet in the User model.

4. **Multilingual content**: Will `content` fields need localisation (ES, EN, FR)? If so, a `KnowledgeNodeTranslation` model will be required. Defer to Phase 3 scope definition.

5. **Edge versioning**: KnowledgeEdges are currently not versioned (unlike nodes). If an edge's `type` or `description` needs to change, the current design requires deactivating the old edge (`isActive: false`) and creating a new one. Is this sufficient, or do we need an `KnowledgeEdgeVersion` table? Recommendation: the deactivate-and-replace pattern is sufficient for now; add versioning if audit trail on edge history becomes a certification requirement.
