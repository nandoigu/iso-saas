import { defineConfig } from "vitest/config";
import path from "path";
import { config } from "dotenv";

// Load .env.test before workers start — overrides DATABASE_URL for all forks
config({ path: ".env.test", override: true });

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["services/**", "app/api/**"],
      exclude: ["app/api/auth/**", "app/api/cron/**"],
    },
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
