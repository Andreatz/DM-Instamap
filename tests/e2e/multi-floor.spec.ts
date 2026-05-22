import { expect, test } from "@playwright/test";
import {
  createPlaywrightProject,
  deleteProjectQuietly,
  fetchProjectDocument
} from "./helpers";

test("multi-floor save creates linked floors and the floors page lists them", async ({
  page,
  request
}) => {
  const base = await createPlaywrightProject(
    request,
    `Playwright MultiFloor ${Date.now()}`
  );
  const createdIds: string[] = [base.id];

  try {
    const document = await fetchProjectDocument(request, base.id);

    const response = await request.post("/api/projects/multi-floor", {
      data: {
        baseSlug: `playwright-multifloor-${Date.now()}`,
        documents: [document, document],
        name: "Playwright Multi-floor"
      }
    });
    expect(response.status()).toBe(201);
    const body = (await response.json()) as {
      ok: boolean;
      projects: Array<{ id: string }>;
    };
    expect(body.ok).toBe(true);
    expect(body.projects).toHaveLength(2);
    for (const project of body.projects) {
      createdIds.push(project.id);
    }

    const firstFloorId = body.projects[0]?.id;
    expect(firstFloorId).toBeTruthy();

    await page.goto(`/projects/${firstFloorId}/floors`, {
      waitUntil: "domcontentloaded"
    });

    await expect(page.getByRole("heading", { name: /Piani$/ })).toBeVisible();
    await expect(page.getByText(/2 progetti collegati/)).toBeVisible();
    await expect(
      page.getByRole("heading", { exact: true, name: "Piano 1" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { exact: true, name: "Piano 2" })
    ).toBeVisible();
  } finally {
    for (const id of createdIds) {
      await deleteProjectQuietly(request, id);
    }
  }
});
