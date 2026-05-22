import { defineConfig } from "vitest/config";

export default defineConfig({
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
