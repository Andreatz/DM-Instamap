import path from "node:path";
import { createAssetManifestResolver } from "@dm-instamap/exporters";
import { findWorkspaceRoot } from "./assets-manifest";

/**
 * Build an asset resolver pinned to the workspace `data/` directory.
 *
 * The export routes run inside Next.js, whose `process.cwd()` is `apps/web`,
 * not the repo root. `createAssetManifestResolver()` defaults to
 * `process.cwd()/data`, so without this it would look in `apps/web/data` (which
 * does not exist) and every placed asset would fall back to a marker. Resolving
 * the workspace root the same way `loadAssetManifest` does keeps the export in
 * sync with the library shown in the UI.
 */
export async function createWorkspaceAssetResolver() {
  const workspaceRoot = await findWorkspaceRoot(process.cwd());
  return createAssetManifestResolver({
    outputRoot: path.join(workspaceRoot, "data")
  });
}
