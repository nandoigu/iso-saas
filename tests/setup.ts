import { prisma } from "@/app/lib/prisma";

// Ensure test DB is used — fail fast if misconfigured
if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL is not set. Create a Neon branch and add it to .env.test"
  );
}

afterAll(async () => {
  await prisma.$disconnect();
});
