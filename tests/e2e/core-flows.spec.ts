import { expect, test } from "@playwright/test";

test("home loads the local-first dashboard", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /prepara la prossima sessione/i })).toBeVisible();
  await expect(page.getByRole("link", { exact: true, name: "Crea una Nuova Mappa" })).toBeVisible();
  await expect(page.getByText(/nessuna api richiesta/i)).toBeVisible();
});

test("generator preview exposes quality debug and mode-specific controls", async ({ page }) => {
  await page.goto("/generate");

  await expect(page.getByRole("heading", { name: "Genera dungeon" })).toBeVisible();
  await expect(page.getByText(/qualita \d+\/100/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Debug qualita" })).toBeVisible();

  await page.getByLabel("Modalita").selectOption("outdoor");
  await expect(page.getByText(/densita alberi/i)).toBeVisible();
  await expect(page.getByText("Includi fiume con ponti")).toBeVisible();
});

test("new project wizard can reach the generation review without remote services", async ({ page }) => {
  await page.goto("/projects/new");

  await expect(page.getByRole("heading", { name: "Wizard nuova mappa" })).toBeVisible();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByRole("heading", { name: "Tipo di mappa" })).toBeVisible();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByRole("heading", { name: "Stile di riferimento" })).toBeVisible();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByRole("heading", { name: "Gruppi di asset" })).toBeVisible();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByRole("heading", { name: "Riepilogo e generazione" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Genera progetto" })).toBeVisible();
});

test("campaigns page loads without external services", async ({ page }) => {
  await page.goto("/campaigns", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { exact: true, name: "Campagne" })).toBeVisible();
  await expect(page.getByText(/locale/i).first()).toBeVisible();
});

test("projects page loads the local project workspace", async ({ page }) => {
  await page.goto("/projects", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { exact: true, name: "Progetti" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Crea nuovo progetto" })).toBeVisible();
});
