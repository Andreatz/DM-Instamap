import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**"],
      reporter: ["text-summary", "json-summary"],
      // core e in larga parte composto da schemi Zod dichiarativi: il target
      // roadmap dell'80% richiede test aggiuntivi sui rami degli schemi.
      // Questa soglia e un gate anti-regressione sulla copertura attuale.
      thresholds: {
        lines: 72
      }
    }
  }
});
