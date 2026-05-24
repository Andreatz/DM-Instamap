/**
 * `pnpm assets:group`
 *
 * Regenerates the legacy integration file `data/indexes/asset-groups.json` from
 * the semantic taxonomy manifest (`data/assets/asset-manifest.json`). This
 * replaces the old folder/aspect/colour grouping: the file keeps its shape (so
 * the exporter resolver, editor and AI bridge keep working) but now holds a few
 * hundred semantic `macroCategory / assetGroup` groups instead of ~one per
 * asset. Run `pnpm assets:manifest` first; it also emits this file.
 */

import {
  type AssetManifest,
  TAXONOMY_PATHS
} from "../../packages/assets/src/taxonomy/index.ts";
import {
  ASSET_GROUPS_INDEX_PATH,
  failWith,
  logLine,
  tryLoadJson,
  writeAssetGroupsIndex
} from "./_shared.ts";

async function main(): Promise<void> {
  const manifest = await tryLoadJson<AssetManifest>(
    TAXONOMY_PATHS.finalManifest
  );

  if (!manifest?.assets) {
    failWith(
      `Manifest finale non trovato (${TAXONOMY_PATHS.finalManifest}). Esegui prima assets:manifest.`
    );
  }

  const groupCount = await writeAssetGroupsIndex(manifest.assets);
  logLine(
    `Gruppi semantici: ${groupCount} (da ${manifest.assets.length} asset) -> ${ASSET_GROUPS_INDEX_PATH}`
  );
}

main().catch((error: unknown) => {
  failWith(
    error instanceof Error ? error.message : "Errore build-groups-index."
  );
});
