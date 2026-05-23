import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only run source tests; never pick up compiled copies under dist/.
    exclude: [...configDefaults.exclude, "dist/**"],
    coverage: {
      provider: "v8",
      include: ["src/**"],
      reporter: ["text-summary", "json-summary"],
      thresholds: {
        lines: 85
      }
    }
  }
});
