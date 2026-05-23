import path from "node:path";
import { createAssetManifestResolver } from "@dm-instamap/exporters";
import { loadAssetGroups } from "./asset-groups";
import { findWorkspaceRoot } from "./assets-manifest";

export type TileTextureSelection = {
  floorTextureAssetId?: string;
  wallTextureAssetId?: string;
};

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

/**
 * Pick representative floor and wall tile textures from the local asset groups
 * (highest quality per kind). Returns group ids, which the resolver maps to a
 * real file. Empty when the library has no floor/wall groups; the export then
 * keeps the flat tile colours.
 */
export async function pickTileTextureIds(): Promise<TileTextureSelection> {
  let groups: Awaited<ReturnType<typeof loadAssetGroups>>["groups"];
  try {
    ({ groups } = await loadAssetGroups());
  } catch {
    return {};
  }

  // "Colorable"/"Clr" tiles ship a flat placeholder tint (often a garish red)
  // meant to be recoloured, so prefer non-colorable textures when available.
  const isColorable = (group: (typeof groups)[number]): boolean =>
    /\bclr\b|colou?rable/.test(
      [group.name, ...group.tags].join(" ").toLowerCase()
    );
  const bestByKind = (kind: string): string | undefined => {
    const candidates = groups.filter((group) => group.kind === kind);
    const preferred = candidates.filter((group) => !isColorable(group));
    const pool = preferred.length > 0 ? preferred : candidates;
    return pool
      .sort(
        (left, right) => (right.qualityScore ?? 0) - (left.qualityScore ?? 0)
      )
      .at(0)?.id;
  };

  const selection: TileTextureSelection = {};
  const floor = bestByKind("floor");
  const wall = bestByKind("wall");
  if (floor) {
    selection.floorTextureAssetId = floor;
  }
  if (wall) {
    selection.wallTextureAssetId = wall;
  }
  return selection;
}
