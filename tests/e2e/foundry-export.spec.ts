import { expect, test } from "@playwright/test";
import { createPlaywrightProject, deleteProjectQuietly } from "./helpers";

test("foundry export produces a valid zip and honours the journal toggle", async ({
  request
}) => {
  const project = await createPlaywrightProject(
    request,
    `Playwright Foundry ${Date.now()}`
  );

  try {
    const withJournals = await request.post(
      `/api/projects/${project.id}/export`,
      {
        data: { format: "foundry", includeGrid: false, includeJournals: true }
      }
    );
    expect(withJournals.status()).toBe(200);
    expect(withJournals.headers()["content-type"]).toContain("application/zip");
    const withJournalsBody = await withJournals.body();
    // ZIP magic header "PK".
    expect(Array.from(withJournalsBody.subarray(0, 2))).toEqual([80, 75]);
    // Filenames are stored in plaintext in the zip directory.
    expect(withJournalsBody.toString("latin1")).toContain("module.json");
    expect(withJournalsBody.toString("latin1")).toContain("journal.db");

    const withoutJournals = await request.post(
      `/api/projects/${project.id}/export`,
      {
        data: { format: "foundry", includeGrid: false, includeJournals: false }
      }
    );
    expect(withoutJournals.status()).toBe(200);
    const withoutJournalsBody = await withoutJournals.body();
    expect(Array.from(withoutJournalsBody.subarray(0, 2))).toEqual([80, 75]);
    expect(withoutJournalsBody.toString("latin1")).toContain("module.json");
    expect(withoutJournalsBody.toString("latin1")).not.toContain("journal.db");
  } finally {
    await deleteProjectQuietly(request, project.id);
  }
});
