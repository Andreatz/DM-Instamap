import { expect, test } from "@playwright/test";
import {
  createPlaywrightProject,
  deleteProjectQuietly,
  fetchProjectDocument,
  openHydratedEditor,
  seedPlacedAssets
} from "./helpers";

test("editor supports undo and redo of a canvas edit", async ({
  page,
  request
}) => {
  const project = await createPlaywrightProject(
    request,
    `Playwright UndoRedo ${Date.now()}`
  );

  try {
    // Una mutazione deterministica (incolla di un asset) garantisce una voce di
    // undo a prescindere dal contenuto generato della mappa.
    await seedPlacedAssets(request, project.id, 1);
    await openHydratedEditor(page, project.id);
    await expect(page.getByText("Pronto")).toBeVisible();

    const inspector = page.locator(".editor-inspector");
    await inspector.getByRole("button", { name: "Seleziona visibili" }).click();
    await inspector.getByRole("button", { exact: true, name: "Copia" }).click();
    await inspector
      .getByRole("button", { exact: true, name: "Incolla" })
      .click();

    const undoButton = page.getByRole("button", {
      exact: true,
      name: "Annulla"
    });
    const redoButton = page.getByRole("button", {
      exact: true,
      name: "Ripristina"
    });

    // La mutazione ha creato una voce di undo: annulla abilitato, ripristina no.
    await expect(undoButton).toBeEnabled();
    await expect(redoButton).toBeDisabled();

    // Annulla -> il ripristino diventa disponibile (cuore di undo/redo).
    await undoButton.click();
    await expect(redoButton).toBeEnabled();

    // Ripristina -> l'operazione torna sullo stack di annullamento.
    await redoButton.click();
    await expect(undoButton).toBeEnabled();
  } finally {
    await deleteProjectQuietly(request, project.id);
  }
});

test("editor can copy, paste, group and ungroup selected assets", async ({
  page,
  request
}) => {
  const project = await createPlaywrightProject(
    request,
    `Playwright Assets ${Date.now()}`
  );

  try {
    await seedPlacedAssets(request, project.id, 2);
    await openHydratedEditor(page, project.id);
    await expect(page.getByText("Pronto")).toBeVisible();

    const inspector = page.locator(".editor-inspector");
    const selectedCount = inspector
      .locator("div", { hasText: "Asset selezionati" })
      .locator("dd");

    // Copy + paste doubles the placed assets.
    await inspector.getByRole("button", { name: "Seleziona visibili" }).click();
    await expect(selectedCount).toHaveText("2");
    await inspector.getByRole("button", { exact: true, name: "Copia" }).click();
    await inspector
      .getByRole("button", { exact: true, name: "Incolla" })
      .click();

    await page.getByRole("button", { name: "Salva progetto" }).click();
    await expect(page.getByText(/progetto salvato/i)).toBeVisible();

    const afterPaste = await fetchProjectDocument(request, project.id);
    expect(afterPaste.assets?.length).toBe(4);

    // Group all visible assets, then ungroup them.
    await inspector.getByRole("button", { name: "Seleziona visibili" }).click();
    await inspector
      .getByRole("button", { exact: true, name: "Raggruppa" })
      .click();
    await page.getByRole("button", { name: "Salva progetto" }).click();
    await expect(page.getByText(/progetto salvato/i)).toBeVisible();

    const afterGroup = await fetchProjectDocument(request, project.id);
    const groupIds = (afterGroup.assets ?? [])
      .map((asset) => asset.groupId)
      .filter((value): value is string => typeof value === "string");
    expect(groupIds.length).toBeGreaterThanOrEqual(2);
    expect(new Set(groupIds).size).toBe(1);

    await inspector.getByRole("button", { name: "Seleziona visibili" }).click();
    await inspector
      .getByRole("button", { exact: true, name: "Separa" })
      .click();
    await page.getByRole("button", { name: "Salva progetto" }).click();
    await expect(page.getByText(/progetto salvato/i)).toBeVisible();

    const afterUngroup = await fetchProjectDocument(request, project.id);
    const remainingGroups = (afterUngroup.assets ?? []).filter(
      (asset) => typeof asset.groupId === "string"
    );
    expect(remainingGroups).toHaveLength(0);
  } finally {
    await deleteProjectQuietly(request, project.id);
  }
});
