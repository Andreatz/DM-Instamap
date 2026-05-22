import { expect, test } from "@playwright/test";
import {
  createPlaywrightProject,
  deleteProjectQuietly,
  type TestProject
} from "./helpers";

test("home loads the local-first dashboard", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /prepara la prossima sessione/i })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { exact: true, name: "Crea una Nuova Mappa" })
  ).toBeVisible();
  await expect(page.getByText(/nessuna api richiesta/i)).toBeVisible();
});

test("generator preview exposes quality debug and mode-specific controls", async ({
  page
}) => {
  await page.goto("/generate");

  await expect(
    page.getByRole("heading", { name: "Genera dungeon" })
  ).toBeVisible();
  await expect(page.getByText(/qualita \d+\/100/i)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Debug qualita" })
  ).toBeVisible();

  await page.getByLabel("Modalita").selectOption("outdoor");
  await expect(page.getByText(/densita alberi/i)).toBeVisible();
  await expect(page.getByText("Includi fiume con ponti")).toBeVisible();
});

test("new project wizard can reach the generation review without remote services", async ({
  page
}) => {
  await page.goto("/projects/new");

  await expect(
    page.getByRole("heading", { name: "Wizard nuova mappa" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(
    page.getByRole("heading", { name: "Tipo di mappa" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(
    page.getByRole("heading", { name: "Stile di riferimento" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(
    page.getByRole("heading", { name: "Gruppi di asset" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(
    page.getByRole("heading", { name: "Riepilogo e generazione" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Genera progetto" })
  ).toBeVisible();
});

test("campaigns page loads without external services", async ({ page }) => {
  await page.goto("/campaigns", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { exact: true, name: "Campagne" })
  ).toBeVisible();
  await expect(page.getByText(/locale/i).first()).toBeVisible();
});

test("projects page loads the local project workspace", async ({ page }) => {
  await page.goto("/projects", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { exact: true, name: "Progetti" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Crea nuovo progetto" })
  ).toBeVisible();
});

test("project editor can save a canvas edit and export a PNG", async ({
  page,
  request
}) => {
  const projectName = `Playwright Editor ${Date.now()}`;
  const createResponse = await request.post("/api/projects", {
    data: {
      heightCells: 18,
      name: projectName,
      roomCount: 4,
      theme: "playwright",
      widthCells: 24
    }
  });
  expect(createResponse.status()).toBe(201);
  const createBody = (await createResponse.json()) as {
    project: {
      id: string;
    };
  };
  const projectId = createBody.project.id;

  try {
    await page.goto(`/projects/${projectId}/editor`, {
      waitUntil: "domcontentloaded"
    });
    await expect(
      page.getByRole("heading", { name: projectName })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Salva progetto" })
    ).toBeVisible();
    await expect(
      page.locator('.editor-shell[data-hydrated="true"]')
    ).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText("Pronto")).toBeVisible();

    await page
      .locator(".editor-tool-grid")
      .getByRole("button", { exact: true, name: "Cancella" })
      .click();
    await expect(page.getByText(/Strumento: Cancella/)).toBeVisible();
    const canvas = page.getByLabel("Canvas mappa modificabile");
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    await page.mouse.click((box?.x ?? 0) + 84, (box?.y ?? 0) + 84);
    await expect(page.getByText(/Annulla [1-9]/)).toBeVisible();
    await page.getByRole("button", { name: "Salva progetto" }).click();
    await expect(page.getByText(/progetto salvato/i)).toBeVisible();

    const savedResponse = await request.get(`/api/projects/${projectId}`);
    expect(savedResponse.status()).toBe(200);
    const savedBody = (await savedResponse.json()) as {
      project: {
        document: {
          tiles: Array<{ kind: string; x: number; y: number }>;
        };
      };
    };
    expect(
      savedBody.project.document.tiles.find(
        (tile) => tile.x === 3 && tile.y === 3
      )?.kind
    ).toBe("empty");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Esporta mappa" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.png$/);
    await expect(page.getByText(/PNG esportato/i)).toBeVisible();
  } finally {
    await request.delete(`/api/projects/${projectId}`).catch(() => {
      // Cleanup is best-effort: project data lives in ignored local runtime folders.
    });
  }
});

test("project snapshots can diff and restore document changes", async ({
  request
}) => {
  const project = await createPlaywrightProject(
    request,
    `Playwright Snapshot ${Date.now()}`
  );

  try {
    const projectResponse = await request.get(`/api/projects/${project.id}`);
    expect(projectResponse.status()).toBe(200);
    const projectBody = (await projectResponse.json()) as {
      project: TestProject;
    };
    const originalDocument = projectBody.project.document;
    const originalTile =
      originalDocument.tiles.find((tile) => tile.kind !== "empty") ??
      originalDocument.tiles[0];
    expect(originalTile).toBeTruthy();

    const snapshotResponse = await request.post(
      `/api/projects/${project.id}/snapshots`,
      {
        data: {
          label: "before-playwright-change"
        }
      }
    );
    expect(snapshotResponse.status()).toBe(200);
    const snapshotBody = (await snapshotResponse.json()) as {
      snapshot: {
        contentHash: string;
      };
    };
    expect(snapshotBody.snapshot.contentHash).toMatch(/^[a-f0-9]{16,64}$/);

    const changedDocument = structuredClone(originalDocument);
    const changedTile = changedDocument.tiles.find(
      (tile) => tile.x === originalTile.x && tile.y === originalTile.y
    );
    expect(changedTile).toBeTruthy();
    if (changedTile) {
      changedTile.kind = originalTile.kind === "empty" ? "floor" : "empty";
    }

    const updateResponse = await request.put(`/api/projects/${project.id}`, {
      data: {
        document: changedDocument
      }
    });
    expect(updateResponse.status()).toBe(200);

    const diffResponse = await request.get(
      `/api/projects/${project.id}/snapshots/${snapshotBody.snapshot.contentHash}/diff?against=current`
    );
    expect(diffResponse.status()).toBe(200);
    const diffBody = (await diffResponse.json()) as {
      diff: {
        changedFields: string[];
        identical: boolean;
      };
    };
    expect(diffBody.diff.identical).toBe(false);
    expect(diffBody.diff.changedFields).toContain("tiles");

    const restoreResponse = await request.post(
      `/api/projects/${project.id}/snapshots/${snapshotBody.snapshot.contentHash}`
    );
    expect(restoreResponse.status()).toBe(200);

    const restoredResponse = await request.get(`/api/projects/${project.id}`);
    expect(restoredResponse.status()).toBe(200);
    const restoredBody = (await restoredResponse.json()) as {
      project: TestProject;
    };
    const restoredTile = restoredBody.project.document.tiles.find(
      (tile) => tile.x === originalTile.x && tile.y === originalTile.y
    );
    expect(restoredTile?.kind).toBe(originalTile.kind);
  } finally {
    await deleteProjectQuietly(request, project.id);
  }
});

test("project export API returns WEBP dd2vtt and Session Pack artifacts", async ({
  request
}) => {
  const project = await createPlaywrightProject(
    request,
    `Playwright Export ${Date.now()}`,
    {
      heightCells: 8,
      roomCount: 2,
      widthCells: 10
    }
  );

  try {
    const webpResponse = await request.post(
      `/api/projects/${project.id}/export`,
      {
        data: {
          format: "webp",
          includeGrid: false,
          scale: 1
        }
      }
    );
    expect(webpResponse.status()).toBe(200);
    expect(webpResponse.headers()["content-type"]).toContain("image/webp");
    expect((await webpResponse.body()).byteLength).toBeGreaterThan(100);

    const dd2vttResponse = await request.post(
      `/api/projects/${project.id}/export`,
      {
        data: {
          format: "dd2vtt",
          includeGrid: false,
          scale: 1
        }
      }
    );
    expect(dd2vttResponse.status()).toBe(200);
    expect(dd2vttResponse.headers()["content-type"]).toContain(
      "application/json"
    );
    const dd2vttBody = JSON.parse(await dd2vttResponse.text()) as {
      format: number;
      resolution?: {
        map_size?: {
          x?: number;
          y?: number;
        };
      };
    };
    expect(dd2vttBody.format).toBe(0.3);
    expect(dd2vttBody.resolution?.map_size?.x).toBe(project.document.width);
    expect(dd2vttBody.resolution?.map_size?.y).toBe(project.document.height);

    const sessionPackResponse = await request.post(
      `/api/projects/${project.id}/export`,
      {
        data: {
          description: "Playwright export regression pack",
          format: "session-pack",
          includeGrid: false,
          includeInitiative: true,
          scale: 1
        }
      }
    );
    expect(sessionPackResponse.status()).toBe(200);
    expect(sessionPackResponse.headers()["content-type"]).toContain(
      "application/zip"
    );
    const sessionPackBody = await sessionPackResponse.body();
    expect(sessionPackBody.byteLength).toBeGreaterThan(100);
    expect(Array.from(sessionPackBody.subarray(0, 2))).toEqual([80, 75]);
  } finally {
    await deleteProjectQuietly(request, project.id);
  }
});

test("session-ready page exports a player map and records export history", async ({
  page,
  request
}) => {
  const project = await createPlaywrightProject(
    request,
    `Playwright Session ${Date.now()}`,
    {
      heightCells: 16,
      roomCount: 4,
      widthCells: 22
    }
  );

  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/asset indicizzati/)).toBeVisible();

    await page.goto(`/projects/${project.id}`, {
      waitUntil: "domcontentloaded"
    });
    await expect(
      page.getByRole("heading", { name: project.name })
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Pronto per la sessione" })
      .first()
      .click();

    await expect(page).toHaveURL(
      new RegExp(`/projects/${project.id}/session-ready$`)
    );
    await expect(
      page.getByRole("heading", { name: /Pronto per la sessione/ })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { exact: true, name: "Requisiti" })
    ).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "PNG giocatori" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.png$/);

    const historyResponse = await request.get(`/api/projects/${project.id}`);
    expect(historyResponse.status()).toBe(200);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Export recenti" })
    ).toBeVisible();
    await expect(page.locator(".export-history-list li").first()).toContainText(
      "Giocatori"
    );
  } finally {
    await deleteProjectQuietly(request, project.id);
  }
});
