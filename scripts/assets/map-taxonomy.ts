/**
 * `pnpm assets:map-taxonomy`
 *
 * Reads `data/assets/imports/imported-tags.json`, applies the tag -> taxonomy
 * rules (macroCategory, assetGroups, VM extraction, anti-carpet rules, status)
 * and writes:
 *   - data/assets/manifests/mapped-assets.json
 *   - data/assets/taxonomy/asset-taxonomy.json
 */

import {
  assembleManifestItem,
  type AssetManifestItem,
  type ImportedTags,
  mapSourceTags,
  type SeedTaxonomy,
  TAXONOMY_PATHS
} from "../../packages/assets/src/taxonomy/index.ts";
import { logLine, loadJson, saveJson, tryLoadJson } from "./_shared.ts";

const MERGED_V3 =
  "data/assets/imports/dm_instamap_merged_dungeondraft_tags_v3.json";
const TAXONOMY_V3 = "data/assets/taxonomy/dm_instamap_taxonomy_merged_v3.json";

async function main(): Promise<void> {
  const imported = await loadImportedTags();
  const seed = await loadSeedTaxonomy();
  if (Object.keys(seed).length > 0) {
    logLine(
      `Seed taxonomy v3: ${Object.keys(seed).length} sourceTag pre-classificati.`
    );
  } else {
    logLine("Nessun seed v3 trovato; uso solo le regole keyword.");
  }

  const items: AssetManifestItem[] = [];
  const statusCounts: Record<string, number> = {};
  const macroCounts: Record<string, number> = {};

  for (const [assetPath, entry] of Object.entries(imported.assets)) {
    const mapped = mapSourceTags({
      path: assetPath,
      sourceTags: entry.sourceTags,
      seed
    });
    const item = assembleManifestItem({ path: assetPath, mapped });
    items.push(item);
    statusCounts[item.status] = (statusCounts[item.status] ?? 0) + 1;
    macroCounts[item.macroCategory] =
      (macroCounts[item.macroCategory] ?? 0) + 1;
  }

  items.sort((a, b) => a.path.localeCompare(b.path));

  await saveJson(
    TAXONOMY_PATHS.mappedAssets,
    { version: 1, assets: items },
    { pretty: false }
  );
  await saveJson(
    TAXONOMY_PATHS.assetTaxonomy,
    buildSourceTagTaxonomy(imported, seed),
    { pretty: true }
  );

  logLine(
    [
      `Asset mappati: ${items.length}`,
      `Macro categorie: ${JSON.stringify(macroCounts)}`,
      `Stati: ${JSON.stringify(statusCounts)}`,
      `Output: ${TAXONOMY_PATHS.mappedAssets}`,
      `Output: ${TAXONOMY_PATHS.assetTaxonomy}`
    ].join("\n")
  );
}

async function loadImportedTags(): Promise<ImportedTags> {
  const imported = await tryLoadJson<ImportedTags>(TAXONOMY_PATHS.importedTags);
  if (imported?.assets) {
    return imported;
  }

  // Fall back to the merged v3 export and rebuild the assets map.
  const merged = await loadJson<{ tags: Record<string, string[]> }>(MERGED_V3);
  const assets: ImportedTags["assets"] = {};
  for (const [tag, paths] of Object.entries(merged.tags)) {
    for (const rawPath of paths) {
      const assetPath = rawPath.replaceAll("\\", "/");
      assets[assetPath] ??= { sourceTags: [] };
      const bucket = assets[assetPath]!;
      if (!bucket.sourceTags.includes(tag)) {
        bucket.sourceTags.push(tag);
      }
    }
  }
  return {
    sourceFiles: [MERGED_V3],
    tags: merged.tags,
    assets,
    stats: {
      sourceFiles: 1,
      sourceTags: Object.keys(merged.tags).length,
      uniqueAssetPaths: Object.keys(assets).length,
      dedupedAssociations: 0,
      parseErrors: []
    }
  };
}

async function loadSeedTaxonomy(): Promise<SeedTaxonomy> {
  type V3Entry = {
    macroCategory: string;
    assetGroups?: string[];
    themeTags?: string[];
    placementTags?: string[];
    sourcePack?: string | null;
  };
  const v3 = await tryLoadJson<{ sourceTagTaxonomy: Record<string, V3Entry> }>(
    TAXONOMY_V3
  );
  if (!v3?.sourceTagTaxonomy) {
    return {};
  }

  const seed: SeedTaxonomy = {};
  for (const [tag, entry] of Object.entries(v3.sourceTagTaxonomy)) {
    seed[tag] = {
      macroCategory:
        entry.macroCategory as SeedTaxonomy[string]["macroCategory"],
      assetGroups: entry.assetGroups ?? [],
      themeTags: entry.themeTags ?? [],
      placementTags: entry.placementTags ?? [],
      sourcePack: entry.sourcePack ?? null
    };
  }
  return seed;
}

function buildSourceTagTaxonomy(
  imported: ImportedTags,
  seed: SeedTaxonomy
): unknown {
  const sourceTagTaxonomy: Record<string, unknown> = {};

  for (const [tag, paths] of Object.entries(imported.tags)) {
    const mapped = mapSourceTags({ path: "", sourceTags: [tag], seed });
    sourceTagTaxonomy[tag] = {
      macroCategory: mapped.macroCategory,
      assetGroups: mapped.assetGroups,
      themeTags: mapped.themeTags,
      placementTags: mapped.placementTags,
      sourcePacks: mapped.sourcePacks,
      assetCount: paths.length
    };
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    vmHandling: {
      decision:
        "VM è preservato in sourceTags/sourcePacks ma rimosso dai gruppi normalizzati.",
      reason:
        "VM è un prefisso di pack/vendor (Venatus Maps), non una categoria semantica."
    },
    sourceTagTaxonomy
  };
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Errore map-taxonomy."}\n`
  );
  process.exitCode = 1;
});
