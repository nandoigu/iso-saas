const baseUrl = normalizeBaseUrl(
  process.env.SMOKE_BASE_URL || "https://iso-saas-gamma.vercel.app"
);

const publicRoutes = [
  { path: "/login", includes: "BMO ISO 19650" },
  { path: "/register", includes: "Crear cuenta" },
  { path: "/forgot-password", includes: "Recuperar" },
];

const protectedRoutes = [
  "/",
  "/projects",
  "/dashboard",
  "/matrix",
  "/profile",
  "/admin",
];

const apiChecks = [
  {
    path: "/api/auth/me",
    expectedStatus: 401,
    name: "auth/me without session",
  },
  {
    path: "/api/admin/auditors",
    expectedStatus: 401,
    name: "auditors list without session",
  },
  {
    path: "/api/admin/audit-teams",
    expectedStatus: 401,
    name: "audit-teams list without session",
  },
  {
    path: "/api/projects/test-project-id/evidence",
    expectedStatus: 401,
    name: "evidence list without session",
  },
  {
    path: "/api/evidence/nonexistent-id",
    expectedStatus: 401,
    name: "evidence detail without session",
  },
];

const failures = [];

console.log(`Smoke base URL: ${baseUrl}`);

for (const route of publicRoutes) {
  await checkPublicRoute(route);
}

for (const path of protectedRoutes) {
  await checkProtectedRedirect(path);
}

for (const check of apiChecks) {
  await checkApiStatus(check);
}

if (failures.length > 0) {
  console.error("\nSmoke checks failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("\nSmoke checks passed.");

async function checkPublicRoute({ path, includes }) {
  const response = await request(path);
  const text = await response.text();

  if (response.status !== 200) {
    failures.push(`${path} expected 200, received ${response.status}`);
    return;
  }

  if (includes && !text.includes(includes)) {
    failures.push(`${path} did not include expected text: ${includes}`);
    return;
  }

  console.log(`OK public ${path}`);
}

async function checkProtectedRedirect(path) {
  const response = await request(path, { redirect: "manual" });
  const location = response.headers.get("location") || "";

  if (![301, 302, 303, 307, 308].includes(response.status)) {
    failures.push(`${path} expected redirect to login, received ${response.status}`);
    return;
  }

  if (!location.includes("/login")) {
    failures.push(`${path} redirected to unexpected location: ${location}`);
    return;
  }

  console.log(`OK protected ${path}`);
}

async function checkApiStatus({ path, expectedStatus, name }) {
  const response = await request(path, { redirect: "manual" });

  if (response.status !== expectedStatus) {
    failures.push(
      `${name || path} expected ${expectedStatus}, received ${response.status}`
    );
    return;
  }

  console.log(`OK api ${path}`);
}

async function request(path, init = {}) {
  const url = new URL(path, baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    return await fetch(url, {
      ...init,
      headers: {
        "user-agent": "bmo-iso-smoke-check/1.0",
        ...(init.headers || {}),
      },
      signal: controller.signal,
    });
  } catch (error) {
    failures.push(`${path} request failed: ${error.message}`);
    return new Response("", { status: 599 });
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeBaseUrl(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
