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
    // Los ficheros comparten una unica rama de Neon. En paralelo, cada fork abre su
    // propio pool y las transacciones Serializable del Evidence Graph se bloquean
    // entre si: la suite pasaba de ~45s a ~460s y Neon acababa cerrando conexiones
    // en mitad del cleanup. En serie es determinista y mas rapida.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
