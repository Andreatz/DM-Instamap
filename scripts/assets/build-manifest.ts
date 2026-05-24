/**
 * `pnpm assets:manifest`
 *
 * Applies manual overrides to the mapped (metadata-enriched) assets and writes
 * the final `data/assets/asset-manifest.json` consumed by the generator.
 */

import {
  applyOverrides,
  type AssetManifestItem,
  type AssetOverridesFile,
  buildManifest,
  TAXONOMY_PATHS
} from "../../packages/assets/src/taxonomy/index.ts";
import {
  ASSET_GROUPS_INDEX_PATH,
  logLine,
  saveJson,
  tryLoadJson,
  writeAssetGroupsIndex
} from "./_shared.ts";

type MappedFile = { version: number; assets: AssetManifestItem[] };

async function main(): Promise<void> {
  const source =
    (await tryLoadJson<MappedFile>(TAXONOMY_PATHS.mappedWithMetadata)) ??
    (await tryLoadJson<MappedFile>(TAXONOMY_PATHS.mappedAssets));

  if (!source) {
    throw new Error(
      "Nessun mapped-assets trovato. Esegui prima assets:map-taxonomy."
    );
  }

  const overrides =
    (await tryLoadJson<AssetOverridesFile>(TAXONOMY_PATHS.overridesFile)) ?? {};

  let overriddenCount = 0;
  const items = source.assets.map((item) => {
    const { item: result, applied } = applyOverrides(item, overrides);
    if (applied.length > 0) {
      overriddenCount += 1;
    }
    return result;
  });

  const manifest = buildManifest(items);
  await saveJson(TAXONOMY_PATHS.finalManifest, manifest, { pretty: false });

  // Keep the legacy integration index (consumed by the exporter/editor/AI
  // bridge) in sync, now derived from the semantic taxonomy.
  const groupCount = await writeAssetGroupsIndex(manifest.assets);

  logLine(
    [
      `Manifest finale: ${manifest.stats.totalAssets} asset`,
      `Override applicati a: ${overriddenCount} asset`,
      `Macro categorie: ${JSON.stringify(manifest.stats.macroCategoryCounts)}`,
      `Stati: ${JSON.stringify(manifest.stats.statusCounts)}`,
      `VM tagged: ${manifest.stats.vmTaggedAssets}`,
      `Output: ${TAXONOMY_PATHS.finalManifest}`,
      `Gruppi semantici: ${groupCount} -> ${ASSET_GROUPS_INDEX_PATH}`
    ].join("\n")
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Errore build-manifest."}\n`
  );
  process.exitCode = 1;
});
