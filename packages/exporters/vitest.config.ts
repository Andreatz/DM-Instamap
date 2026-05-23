import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // sharp (native) raster rendering plus v8 coverage can exceed the default
    // 5s timeout on cold Windows CI runners. Give the suite real headroom so
    // these are not flaky; a genuine hang still trips the higher limit.
    testTimeout: 30_000,
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
