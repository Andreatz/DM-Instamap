import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**"],
      reporter: ["text-summary", "json-summary"],
      // Soglia consolidata dopo i test di hardening import della Fase L.
      thresholds: {
        lines: 82
      }
    }
  }
});
