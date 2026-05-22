import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src")
    }
  },
  test: {
    coverage: {
      provider: "v8",
      // Il gate di copertura web si concentra su src/lib (logica pura);
      // i componenti e le pagine UI sono coperti dagli E2E (vedi Fase D).
      include: ["src/lib/**"],
      reporter: ["text-summary", "json-summary"],
      thresholds: {
        lines: 63
      }
    }
  }
});
