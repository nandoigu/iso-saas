import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GET, POST } from "@/app/api/admin/auditors/route";
import { GET as GET_ONE, PATCH } from "@/app/api/admin/auditors/[auditorId]/route";
import { sessionCookie, makeRequest } from "@/tests/helpers/auth";
import {
  createTenant,
  createProject,
  createAuditor,
  cleanupTenant,
} from "@/tests/helpers/db";
import type { AuthUser } from "@/app/lib/auth";

let tenantA: Awaited<ReturnType<typeof createTenant>>;
let tenantB: Awaited<ReturnType<typeof createTenant>>;

function asAuthUser(user: { id: string; email: string; name: string | null; role: string; status: string; companyId: string | null }): AuthUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status, companyId: user.companyId };
}

beforeAll(async () => {
  tenantA = await createTenant("api-auditors-a");
  tenantB = await createTenant("api-auditors-b");
  await createProject(tenantA.company.id, tenantA.admin.id);
});

afterAll(async () => {
  await cleanupTenant(tenantA.company.id);
  await cleanupTenant(tenantB.company.id);
});

// ─── AUTH ─────────────────────────────────────────────────────────────────────

describe("AUTH — autenticación y autorización", () => {
  it("AUTH-01: GET /auditors sin sesión devuelve 401", async () => {
    const res = await GET(makeRequest("/api/admin/auditors"));
    expect(res.status).toBe(401);
  });

  it("AUTH-02: GET /auditors con usuario no-admin devuelve 403", async () => {
    const cookie = sessionCookie(asAuthUser(tenantA.user));
    const res = await GET(makeRequest("/api/admin/auditors", { cookie }));
    expect(res.status).toBe(403);
  });

  it("AUTH-03: GET /auditors con admin válido devuelve 200", async () => {
    const cookie = sessionCookie(asAuthUser(tenantA.admin));
    const res = await GET(makeRequest("/api/admin/auditors", { cookie }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data)).toBe(true);
  });
});

// ─── TENANT ───────────────────────────────────────────────────────────────────

describe("TENANT — aislamiento de tenant", () => {
  it("TENANT-01: GET /auditors/[id] con ID de otro tenant devuelve 404", async () => {
    const auditorB = await createAuditor(tenantB.company.id, tenantB.admin.id);
    const cookie = sessionCookie(asAuthUser(tenantA.admin));

    const res = await GET_ONE(
      makeRequest(`/api/admin/auditors/${auditorB.id}`, { cookie }),
      { params: Promise.resolve({ auditorId: auditorB.id }) }
    );
    expect(res.status).toBe(404);
  });

  it("TENANT-02: GET /auditors devuelve solo auditores del tenant del admin", async () => {
    await createAuditor(tenantA.company.id, tenantA.admin.id, { email: `scope-a-${Date.now()}@test.local` });
    await createAuditor(tenantB.company.id, tenantB.admin.id, { email: `scope-b-${Date.now()}@test.local` });

    const cookie = sessionCookie(asAuthUser(tenantA.admin));
    const res = await GET(makeRequest("/api/admin/auditors", { cookie }));
    const json = await res.json();

    const ids = json.data.map((a: { id: string }) => a.id);
    const auditorBIds = (await import("@/app/lib/prisma").then(m =>
      m.prisma.auditor.findMany({ where: { companyId: tenantB.company.id }, select: { id: true } })
    )).map(a => a.id);

    const hasLeak = ids.some((id: string) => auditorBIds.includes(id));
    expect(hasLeak).toBe(false);
  });

  it("TENANT-03: POST /auditors ignora companyId del body y usa el de la sesión", async () => {
    const cookie = sessionCookie(asAuthUser(tenantA.admin));
    const res = await POST(makeRequest("/api/admin/auditors", {
      method: "POST",
      cookie,
      body: {
        name: "Injected Auditor",
        email: `injected-${Date.now()}@test.local`,
        companyId: tenantB.company.id, // intento de inyección
      },
    }));

    expect(res.status).toBe(201);
    const json = await res.json();
    // El auditor debe pertenecer a tenantA, no a tenantB
    const { prisma } = await import("@/app/lib/prisma");
    const auditor = await prisma.auditor.findUnique({ where: { id: json.data.id } });
    expect(auditor?.companyId).toBe(tenantA.company.id);
  });
});

// ─── VAL — Validación ─────────────────────────────────────────────────────────

describe("VAL — validación de entrada", () => {
  it("VAL-01: POST sin name devuelve 400", async () => {
    const cookie = sessionCookie(asAuthUser(tenantA.admin));
    const res = await POST(makeRequest("/api/admin/auditors", {
      method: "POST",
      cookie,
      body: { email: "noemail@test.local" },
    }));
    expect(res.status).toBe(400);
  });

  it("VAL-02: POST con email inválido devuelve 400", async () => {
    const cookie = sessionCookie(asAuthUser(tenantA.admin));
    const res = await POST(makeRequest("/api/admin/auditors", {
      method: "POST",
      cookie,
      body: { name: "Test", email: "not-an-email" },
    }));
    expect(res.status).toBe(400);
  });

  it("VAL-03: POST con email duplicado en el tenant devuelve 409", async () => {
    const cookie = sessionCookie(asAuthUser(tenantA.admin));
    const email = `dup-${Date.now()}@test.local`;

    await POST(makeRequest("/api/admin/auditors", { method: "POST", cookie, body: { name: "First", email } }));
    const res = await POST(makeRequest("/api/admin/auditors", { method: "POST", cookie, body: { name: "Second", email } }));

    expect(res.status).toBe(409);
  });

  it("VAL-04: PATCH con status inválido devuelve 400", async () => {
    const auditor = await createAuditor(tenantA.company.id, tenantA.admin.id);
    const cookie = sessionCookie(asAuthUser(tenantA.admin));

    const res = await PATCH(
      makeRequest(`/api/admin/auditors/${auditor.id}`, { method: "PATCH", cookie, body: { status: "invalid_status" } }),
      { params: Promise.resolve({ auditorId: auditor.id }) }
    );
    expect(res.status).toBe(400);
  });
});

// ─── HP — Happy path ─────────────────────────────────────────────────────────

describe("HP — happy path", () => {
  it("HP-01: POST crea auditor con companyId de sesión", async () => {
    const cookie = sessionCookie(asAuthUser(tenantA.admin));
    const res = await POST(makeRequest("/api/admin/auditors", {
      method: "POST",
      cookie,
      body: {
        name: "Happy Auditor",
        email: `happy-${Date.now()}@test.local`,
        certificationLevel: "lead_auditor_iso19011",
        isExternal: true,
      },
    }));

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.name).toBe("Happy Auditor");
    expect(json.data.isExternal).toBe(true);
  });

  it("HP-02: GET /auditors devuelve 200 con array", async () => {
    const cookie = sessionCookie(asAuthUser(tenantA.admin));
    const res = await GET(makeRequest("/api/admin/auditors", { cookie }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data)).toBe(true);
  });

  it("HP-03: GET /auditors/[id] devuelve detalle con assignments", async () => {
    const auditor = await createAuditor(tenantA.company.id, tenantA.admin.id);
    const cookie = sessionCookie(asAuthUser(tenantA.admin));

    const res = await GET_ONE(
      makeRequest(`/api/admin/auditors/${auditor.id}`, { cookie }),
      { params: Promise.resolve({ auditorId: auditor.id }) }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.id).toBe(auditor.id);
    expect(Array.isArray(json.data.assignments)).toBe(true);
  });
});
