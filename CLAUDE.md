@AGENTS.md

---

# BAOS — BIM Audit Operating System

## Misión y naturaleza del sistema

BAOS es un sistema IA enterprise diseñado para ejecutar auditorías ISO 19650 de forma gobernada, trazable y certificable. No es un prototipo ni un MVP: es una plataforma de producción real.

Principios estructurales irrenunciables:

- **Evidence-first** — ningún resultado puede existir sin evidencia trazable
- **Explainability-first** — toda conclusión debe poder reconstruirse completamente
- **Human-in-the-loop** — el auditor humano mantiene siempre la autoridad final
- **Governance-first** — toda modificación debe ser gobernada y versionada
- **Multi-tenant isolation** — datos, configuraciones, auditorías y conocimiento completamente aislados por cliente
- **Certification-ready** — la arquitectura soporta certificación futura
- **Graph-centric / Knowledge-centric** — el conocimiento normativo es un grafo, no un catálogo plano
- **Security by design** — RBAC, trazabilidad completa, cifrado, mínimos privilegios

---

## Estado de la arquitectura: FROZEN

La arquitectura conceptual, funcional y de gobernanza de BAOS está completamente diseñada y validada. La fase actual es **materialización tecnológica**, no diseño.

**No está permitido:**
- Rediseñar componentes principales
- Modificar modelos conceptuales
- Simplificar el sistema a un MVP
- Eliminar mecanismos de gobernanza
- Sustituir supervisión humana por automatismo no gobernado
- Introducir aprendizaje autónomo no controlado
- Modificar contratos funcionales ya definidos

---

## Fases conceptuales completadas (baseline obligatorio)

| Fase | Nombre |
|------|--------|
| 1 | Formalización estructural |
| 2 | Executive Architecture |
| 3 | Production Runtime Architecture |
| 4 | Enterprise Implementation Architecture |
| 5 | Certification & Governance Architecture |
| 6 | Productization & Commercialization Architecture |
| 7 | Knowledge Architecture |
| 8 | Canonical Enterprise Architecture |
| 9 | Training Corpus Completion |
| 10 | Training Data Governance & Validation Protocol |
| 11 | Knowledge Acquisition & Corpus Ingestion Factory |
| 12 | Training Dataset Design & Model Calibration Strategy |
| 13 | Human Expert Validation & Audit Benchmarking Protocol |
| 14 | Auditor Reasoning Evaluation & Explainability Certification |
| 15 | Continuous Audit Learning System (CALS) |
| 16 | Operational Certification & Controlled Deployment Framework (OCCDF) |
| 17 | Enterprise Client Implementation & Real-World Audit Onboarding Framework (ECIROF) |

---

## Core Components (inmutables — implementar, no rediseñar)

| Componente | Rol en BAOS |
|-----------|-------------|
| Knowledge Graph | Representación estructurada del conocimiento normativo ISO 19650 |
| Requirement Graph | Grafo de requisitos con dependencias, precedencias y relaciones |
| Evidence Graph | Trazabilidad entre evidencias, requisitos y conclusiones de auditoría |
| Canonical Data Model | Modelo de datos compartido entre todos los componentes |
| Rule Engine | Motor de evaluación de reglas normativas |
| Contradiction Engine | Detección de inconsistencias entre evidencias y conclusiones |
| Audit Runtime | Ejecución controlada del proceso de auditoría |
| Audit Digital Twin | Representación digital del objeto auditado |
| CAOS | Cognitive Audit Operating System — núcleo de razonamiento |
| Audit Intelligence Platform | Capa de IA gobernada sobre el runtime de auditoría |
| Training Factory | Pipeline de generación y validación de datos de entrenamiento |
| Benchmark Framework | Evaluación objetiva del rendimiento del sistema |
| Explainability Framework | Reconstrucción completa de cualquier conclusión |
| CALS | Continuous Audit Learning System — mejora continua gobernada |
| OCCDF | Operational Certification & Controlled Deployment Framework |
| ECIROF | Enterprise Client Implementation & Real-World Audit Onboarding Framework |

---

## Plan de implementación tecnológica (fases activas)

```
PHASE 1 — Technological Foundation        ← FASE ACTUAL
↓
PHASE 2 — Core Platform Infrastructure
↓
PHASE 3 — Knowledge Layer Implementation
↓
PHASE 4 — Audit Runtime Implementation
↓
PHASE 5 — Governance & Explainability Layer
↓
PHASE 6 — Enterprise Operations Layer
↓
PHASE 7 — Production Deployment
```

---

## Enfoque de ingeniería requerido

Para cada funcionalidad desarrollada, documentar y respetar:

1. **Strategic Purpose** — por qué existe dentro de BAOS
2. **Architectural Position** — cómo encaja en la arquitectura global
3. **Dependencies** — qué consume y quién depende de ella
4. **Technology Decisions** — justificación de frameworks, patrones, persistencia y APIs
5. **Domain Models** — entidades y relaciones necesarias
6. **API Contracts** — interfaces internas y externas
7. **Security Requirements** — autenticación, autorización y trazabilidad
8. **Deployment Requirements** — infraestructura necesaria para producción
9. **Testing Requirements** — unit, integration, audit, regression, explainability
10. **Documentation Requirements** — técnica, funcional, arquitectónica y operacional

Principios de código: SOLID, Clean Architecture, desacoplamiento alto, alta cohesión, contratos explícitos entre componentes.

---

## Regla de integridad normativa (anti-alucinación)

Está **prohibido inventar** —en código, documentación, tests, seeds, migraciones o respuestas de sesión—:

- requisitos ISO 19650
- cláusulas normativas
- criterios de conformidad
- reglas auditoras
- evidencias

Todo contenido normativo que entre en el sistema debe proceder de una **fuente autorizada y validada como tal por el proyecto**. Si el conocimiento necesario no está disponible, no se rellena con una aproximación plausible: se declara **`ARCHITECTURAL INPUT REQUIRED`** indicando exactamente qué falta y quién debe aportarlo.

Los datos que se necesiten para pruebas o demos se marcan explícitamente como **`SYNTHETIC TEST DATA`**, tanto en el propio dato como en su documentación. Nunca deben poder confundirse con contenido normativo real.

⚠️ **Nota de licencia**: el texto de la ISO 19650 **no es de dominio público** — es material con copyright que ISO y AENOR comercializan. El checklist de `docs/domain-models/knowledge-graph.md` afirma lo contrario ("normative text is public domain"); es incorrecto y debe corregirse al retomar ese componente. Volcar el texto íntegro de la norma en la base de datos o servirlo a los tenants es un riesgo de licencia, no un detalle de implementación. Los requisitos parafraseados de elaboración propia (las `RequirementTemplate` actuales) no tienen ese problema.

**Por qué**: una cláusula inventada dentro de un informe de auditoría es responsabilidad profesional del auditor que lo firma, no un bug del software.

---

## Regla de trazabilidad de inferencia IA (provenance)

BAOS **no se acopla a ningún proveedor LLM**. Toda inferencia pasa por una abstracción `AIProvider`; el dominio no importa SDKs de proveedor directamente.

**La salida de un modelo es siempre una propuesta, nunca un veredicto.** No existe transición autónoma de estado sobre conclusiones de auditoría, hallazgos ni validación de evidencia: el auditor humano confirma o corrige, siguiendo el mismo patrón que `EvidenceValidation.validatedBy`.

Toda inferencia que influya —aunque sea indirectamente— en un resultado de auditoría debe dejar **registro persistente** de:

| Campo | Por qué |
|-------|---------|
| Modelo e identificador exacto de versión | "lo dijo la IA" no es reconstruible; "lo dijo el modelo X versión Y" sí |
| Versión del prompt | el mismo modelo con otro prompt es, a efectos de auditoría, otro sistema |
| Inputs exactos (o referencia estable + hash) | sin las entradas la conclusión no se puede reproducir |
| Parámetros de invocación (temperatura, límites, formato) | afectan al resultado y deben poder replicarse |
| Timestamp | sitúa la inferencia frente a la edición de norma vigente |
| Salida estructurada devuelta | lo que el modelo dijo realmente, antes de interpretarlo |
| Tenant, proyecto y auditoría | aislamiento multi-tenant y ámbito de la conclusión |
| Tokens, coste y latencia | control económico y operativo |

**Regla dura, equivalente al evidence-first**: una inferencia sin provenance registrada **no puede citarse en un informe de auditoría**.

El sistema debe poder responder, para cualquier conclusión asistida por IA: qué modelo la produjo, con qué versión, con qué prompt, sobre qué inputs, cuándo y bajo qué configuración.

---

---

# BMO ISO 19650 — Implementación actual (Phase 1 Foundation)

## Qué es este módulo

La implementación actual (`prueba-app`) constituye la **Phase 1 Technological Foundation** de BAOS: una plataforma SaaS funcional de gestión de cumplimiento ISO 19650, que materializa los primeros contratos del sistema sobre infraestructura de producción real.

Nombre de producto: **BMO ISO 19650**. Marca: **EFICAX**.  
Producción: `https://iso-saas-gamma.vercel.app`  
Repo remoto: `https://github.com/nandoigu/iso-saas.git`  
Rama principal: `main`

---

## Stack actual

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 App Router + TypeScript |
| Base de datos | PostgreSQL (Neon) vía Prisma 5 |
| Autenticación | Propia — cookies HTTP-only firmadas con `AUTH_SECRET` |
| Email | Resend (dominio verificado `no-reply@eficax.com`) |
| Estilos | Tailwind CSS |
| Gráficos | Recharts |
| Exportación PDF | jsPDF + jspdf-autotable |
| Exportación DOCX | docx |
| Importación Excel | exceljs |
| Despliegue | Vercel (auto-deploy desde `main`) |

---

## Estructura del repositorio

```
app/                    # Next.js App Router
  api/                  # Route handlers (server)
  (rutas de página)/    # Page components
  lib/                  # Módulos server-side (auth, email, prisma, imports)
components/             # Componentes React reutilizables
services/               # Lógica de negocio desacoplada de las rutas
lib/                    # Re-exports y utilidades compartidas
utils/                  # Exportaciones cliente (Excel, PDF)
prisma/                 # Schema + migraciones
scripts/                # Scripts de CI/utilidad (smoke tests)
docs/                   # Documentación interna
```

La autenticación **no usa NextAuth** — sistema propio en `app/lib/auth.ts` con JWT firmados en cookie `session`.

---

## Modelos Prisma

| Modelo | Propósito |
|--------|-----------|
| `User` | Usuarios con `role` (admin/user), `status` (active/suspended/blocked), preferencias de notificación |
| `Company` | Empresa propietaria (opcional) |
| `Project` | Proyecto con `role` (adjudicador/adjudicatario_principal/adjudicatario) — el rol **no cambia** tras la creación |
| `Requirement` | Requisito individual con `status`, `deadline`, `norma`, `item`, `evidencia` |
| `RequirementTemplate` | Catálogo global de plantillas de requisitos por rol y norma |
| `PasswordResetToken` | Tokens de recuperación de contraseña (TTL corto) |
| `AuditReport` | Informe de auditoría generado desde un proyecto, con puntuaciones y contenido estructurado en JSON |
| `AuditReportVersion` | Historial de versiones de cada informe (snapshot completo) |

---

## Rutas de página

| Ruta | Descripción |
|------|-------------|
| `/` | Landing / redirección |
| `/login` `/register` `/forgot-password` `/reset-password` | Flujo de autenticación |
| `/dashboard` | Panel BI con KPIs, gráficos, filtros, exportación CSV/PDF, alertas |
| `/projects` | Listado de proyectos del usuario con búsqueda y filtros |
| `/projects/[id]` | Detalle de proyecto: requisitos, importación, edición |
| `/projects/[id]/matrix` | Matriz de cumplimiento por proyecto |
| `/matrix` | Matriz de cumplimiento global |
| `/profile` | Perfil y cambio de contraseña |
| `/admin` | Panel de administración (solo `role: admin`) |
| `/admin/audit-reports` | Módulo de informes de auditoría ISO 19650 |

---

## APIs principales

| Endpoint | Métodos | Función |
|----------|---------|---------|
| `/api/auth/*` | POST/GET | Login, logout, register, forgot/reset/change-password, me |
| `/api/projects` | GET, POST | Listar y crear proyectos |
| `/api/projects/[id]` | GET, PUT, DELETE | CRUD de proyecto |
| `/api/projects/[id]/import-requirements` | POST | Importar Excel a proyecto (modos `append`/`replace`) |
| `/api/requirements` | GET, POST, PUT, DELETE | CRUD de requisitos |
| `/api/generate-requirements` | POST | Generar requisitos desde plantillas globales |
| `/api/import-templates` | POST | Importar plantillas al catálogo global |
| `/api/profile` | GET, PATCH | Perfil del usuario |
| `/api/notifications/preferences` | GET, PATCH | Preferencias de notificación |
| `/api/admin/users` | GET, PATCH, DELETE | Gestión de usuarios (admin) |
| `/api/admin/audit-reports` | GET, POST | Informes de auditoría |
| `/api/admin/audit-reports/[id]` | GET, PATCH, DELETE | Informe individual |
| `/api/admin/audit-reports/[id]/export/[format]` | GET | Exportar PDF o DOCX |
| `/api/cron/alerts` | GET | Cron diario 08:00 UTC — alertas de deadline |

---

## Servicios (`services/`)

| Archivo | Función |
|---------|---------|
| `audit-report.service.ts` | CRUD de `AuditReport` en base de datos, versionado |
| `audit-report.generator.ts` | Construye el contenido estructurado del informe desde datos del proyecto |
| `audit-report.pdf.ts` | Exportación PDF con jsPDF |
| `audit-report.docx.ts` | Exportación DOCX con `docx` |
| `audit-report.types.ts` | Tipos TypeScript del dominio de auditoría |
| `requirement.service.ts` | Generación de requisitos desde plantillas globales |
| `template.service.ts` | Importación de plantillas desde Excel |
| `project-requirement-import.service.ts` | Importación de requisitos a proyecto desde Excel |

---

## Componentes compartidos

| Componente | Uso |
|-----------|-----|
| `Notice.tsx` | Avisos inline (success/error/info/warning) con `role="alert"` o `role="status"` |
| `EmptyState.tsx` | Estado vacío guiado con acción opcional |
| `DestructiveConfirmationDialog.tsx` | Modal de confirmación para acciones destructivas |
| `ComplianceMatrix.tsx` | Matriz de cumplimiento interactiva con filtros |
| `uiStyles.ts` | Tokens de estilos CSS-in-TS compartidos en toda la app |

---

## Variables de entorno requeridas

| Variable | Dónde se usa |
|----------|-------------|
| `DATABASE_URL` | Prisma — conexión a Neon PostgreSQL |
| `AUTH_SECRET` | Firma de cookies de sesión |
| `JWT_SECRET` | Tokens de reset de contraseña |
| `RESEND_API_KEY` | Envío de emails via Resend |
| `EMAIL_FROM` | Dirección remitente (ej. `no-reply@eficax.com`) |
| `APP_URL` | URL base de la app (para links en emails) |
| `CRON_SECRET` | Autenticación del endpoint `/api/cron/alerts` |

---

## Comandos habituales

```powershell
# Desarrollo
npm run dev          # Next.js dev server (--webpack)

# Validación antes de commit/push
cmd /c "npm run lint"
cmd /c "npm run build"   # incluye prisma generate

# Smoke tests contra producción
npm run smoke

# Vercel (usar siempre con cmd /c por política de ejecución de PowerShell)
cmd /c "npx vercel whoami"
cmd /c "npx vercel --prod"
```

---

## Decisiones de producto fijas (no cambiar sin consenso)

- `Project.role` es obligatorio y **no se edita** tras la creación — determina los requisitos cargados.
- Cada usuario solo ve sus propios proyectos; `admin` ve todo.
- Usuarios `user` tienen límite de 5 proyectos.
- Sin colaboración multiusuario dentro de proyectos.
- Importación Excel soporta dos modos: `append` (añade y deduplica) y `replace` (borra y recarga).
- Cron de alertas diario a las 08:00 UTC via Vercel Cron (`vercel.json`).

---

## Estado actual (junio 2026)

Funcionalidad operativa en producción:

- Flujo completo de proyectos y requisitos
- Importación Excel (plantillas globales + por proyecto, modos append/replace)
- Dashboard BI con KPIs, gráficos, filtros, export CSV/PDF, alertas
- Matriz de cumplimiento global y por proyecto
- Panel de administración (gestión de usuarios y proyectos)
- Flujos de autenticación completos (registro, login, forgot/reset password)
- Módulo de informes de auditoría ISO 19650 (`/admin/audit-reports`): generación, edición con versionado, exportación PDF/DOCX
- Sidebar lateral, sistema de estilos compartidos (`uiStyles.ts`), accesibilidad básica
- Smoke tests automatizados (`npm run smoke`)
- Despliegue Vercel + Neon + Resend verificados en producción

### Pendiente abierto

| Prioridad | Tarea |
|-----------|-------|
| Inmediata | Verificación visual/funcional del módulo de audit-reports en Chrome |
| Media | Branding: pulido visual final, datos demo, cuenta demo, presentación comercial |
| Media | Productividad: búsquedas y filtros más potentes, accesos rápidos |
| Baja | Feedback en guardar/editar/importar donde falte |
| Futuro BAOS | Knowledge Graph, Requirement Graph, Evidence Graph, Canonical Data Model, Rule Engine, CAOS, CALS |

---

## Documentación interna (`docs/`)

| Archivo | Contenido |
|---------|-----------|
| `handoff.md` | Historial completo de sesiones, decisiones y plan de trabajo |
| `brand-messaging.md` | Posicionamiento, promesa de marca, mensajes clave y tono |
| `smoke-tests.md` | Instrucciones y cobertura de los smoke tests |
| `deployment-checklist.md` | Checklist de despliegue a producción |
| `demo-test-runbook.md` | Guía de prueba completa con usuario demo |
| `excel-import-format.md` | Formato de importación Excel para usuario final |
| `email-alert-report-validation.md` | Validación de alertas y reportes por email |
| `high-priority-audit-2026-05-10.md` | Auditoría de prioridad alta (mayo 2026) |
