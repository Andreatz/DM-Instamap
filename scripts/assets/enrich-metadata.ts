/**
 * `pnpm assets:metadata [-- --limit 500]`
 *
 * Reads `data/assets/manifests/mapped-assets.json`, locates each asset on disk
 * and enriches it with width/height/aspectRatio/transparency/fileSize/hash via
 * sharp. Does NOT change classification; only adds metadata + qualityFlags.
 * Writes `data/assets/manifests/mapped-assets.with-metadata.json`.
 */

import {
  type AssetManifestItem,
  TAXONOMY_PATHS
} from "../../packages/assets/src/taxonomy/index.ts";
import { enrichAssetMetadata } from "../../packages/assets/src/taxonomy/metadata.ts";
import {
  buildAssetFileIndex,
  loadJson,
  logLine,
  lookupAssetFile,
  parseCliArgs,
  saveJson
} from "./_shared.ts";

type MappedFile = { version: number; assets: AssetManifestItem[] };

async function main(): Promise<void> {
  const { flags } = parseCliArgs(process.argv.slice(2));
  const limit =
    typeof flags.limit === "string" ? Number.parseInt(flags.limit, 10) : null;

  const mapped = await loadJson<MappedFile>(TAXONOMY_PATHS.mappedAssets);
  const assets = limit ? mapped.assets.slice(0, limit) : mapped.assets;

  logLine("Indicizzo i file asset sul disco...");
  const fileIndex = await buildAssetFileIndex();
  logLine(`File asset indicizzati: ${fileIndex.size}`);

  let enriched = 0;
  let missing = 0;
  let processed = 0;

  for (const item of assets) {
    const absolutePath = lookupAssetFile(fileIndex, item.path);
    const result = await enrichAssetMetadata(item, absolutePath);
    item.metadata = result.metadata;
    item.qualityFlags = result.qualityFlags;

    if (absolutePath) {
      enriched += 1;
    } else {
      missing += 1;
    }

    processed += 1;
    if (processed % 2000 === 0) {
      logLine(`  ...${processed}/${assets.length}`);
    }
  }

  await saveJson(
    TAXONOMY_PATHS.mappedWithMetadata,
    { version: mapped.version, assets },
    { pretty: false }
  );

  logLine(
    [
      `Asset processati: ${processed}`,
      `Con metadata reali: ${enriched}`,
      `File mancanti sul disco: ${missing}`,
      `Output: ${TAXONOMY_PATHS.mappedWithMetadata}`
    ].join("\n")
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Errore enrich-metadata."}\n`
  );
  process.exitCode = 1;
});
