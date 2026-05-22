import { describe, expect, it } from "vitest";
import { summarizeAssetLibrary } from "./asset-library-status";

const baseAudit = {
  assetCount: 0,
  classificationWarnings: [] as unknown[],
  duplicateGroupCount: 0,
  generatedAt: null as string | null,
  lowQualityCount: 0,
  missing: true,
  needsReviewCount: 0
};

describe("asset library status", () => {
  it("reports an empty library when nothing is indexed", () => {
    const status = summarizeAssetLibrary({
      audit: { ...baseAudit },
      groupCount: 0,
      manifest: { assetCount: 0, generatedAt: null, missing: true }
    });

    expect(status.tone).toBe("empty");
    expect(status.ready).toBe(false);
    expect(status.headline).toMatch(/Nessun asset/);
  });

  it("reports a ready library with no outstanding issues", () => {
    const status = summarizeAssetLibrary({
      audit: { ...baseAudit, assetCount: 120, generatedAt: "2026-05-01T10:00:00.000Z", missing: false },
      groupCount: 14,
      manifest: { assetCount: 120, generatedAt: "2026-05-01T09:00:00.000Z", missing: false }
    });

    expect(status.tone).toBe("ready");
    expect(status.ready).toBe(true);
    expect(status.assetCount).toBe(120);
    expect(status.lastScan).toBe("2026-05-01T10:00:00.000Z");
    expect(status.headline).toMatch(/libreria in ordine/);
  });

  it("counts duplicates, low quality and review queue as issues", () => {
    const status = summarizeAssetLibrary({
      audit: {
        assetCount: 80,
        classificationWarnings: [{}, {}],
        duplicateGroupCount: 3,
        generatedAt: "2026-05-02T00:00:00.000Z",
        lowQualityCount: 5,
        missing: false,
        needsReviewCount: 7
      },
      groupCount: 9,
      manifest: { assetCount: 80, generatedAt: null, missing: false }
    });

    expect(status.tone).toBe("warning");
    expect(status.issueCount).toBe(3 + 5 + 7 + 2);
    expect(status.headline).toMatch(/da rivedere/);
  });
});
