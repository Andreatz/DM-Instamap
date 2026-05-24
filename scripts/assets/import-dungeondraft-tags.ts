/**
 * `pnpm assets:import-tags -- "local-assets/**\/*.dungeondraft_tags"`
 *
 * Imports Dungeondraft tag files, deduplicates by sourceTag + path, preserves
 * the original sourceTags and writes `data/assets/imports/imported-tags.json`.
 *
 * If no raw tag files are found, falls back to the pre-merged v3 export so the
 * pipeline still works on a fresh checkout.
 */

import path from "node:path";
import { readFile } from "node:fs/promises";
import {
  createImportedTagsAccumulator,
  finalizeImportedTags,
  mergeTagFileIntoImport,
  parseDungeondraftTags,
  TAXONOMY_PATHS,
  type ImportedTags
} from "../../packages/assets/src/taxonomy/index.ts";
import {
  logLine,
  parseCliArgs,
  REPO_ROOT,
  resolveTagFiles,
  saveJson,
  tryLoadJson
} from "./_shared.ts";

const MERGED_V3 =
  "data/assets/imports/dm_instamap_merged_dungeondraft_tags_v3.json";

async function main(): Promise<void> {
  const { positionals } = parseCliArgs(process.argv.slice(2));
  const accumulator = createImportedTagsAccumulator();

  const tagFiles = await resolveTagFiles(positionals);

  if (tagFiles.length > 0) {
    logLine(`Trovati ${tagFiles.length} file .dungeondraft_tags.`);
    for (const file of tagFiles) {
      const relative = path.relative(REPO_ROOT, file).replaceAll("\\", "/");
      try {
        const content = await readFile(file, "utf8");
        const parsed = parseDungeondraftTags(content);
        mergeTagFileIntoImport(accumulator, relative, parsed);
      } catch (error) {
        accumulator.stats.parseErrors.push({
          file: relative,
          message: error instanceof Error ? error.message : "parse error"
        });
      }
    }
  } else {
    logLine(
      "Nessun file .dungeondraft_tags trovato; uso il merge v3 pre-generato."
    );
    await importFromMergedV3(accumulator);
  }

  finalizeImportedTags(accumulator);
  await saveJson(TAXONOMY_PATHS.importedTags, accumulator, { pretty: false });

  logLine(
    [
      `File sorgente: ${accumulator.stats.sourceFiles}`,
      `Tag sorgente unici: ${accumulator.stats.sourceTags}`,
      `Asset/path unici: ${accumulator.stats.uniqueAssetPaths}`,
      `Associazioni deduplicate: ${accumulator.stats.dedupedAssociations}`,
      `Errori di parsing: ${accumulator.stats.parseErrors.length}`,
      `Output: ${TAXONOMY_PATHS.importedTags}`
    ].join("\n")
  );
}

async function importFromMergedV3(accumulator: ImportedTags): Promise<void> {
  const merged = await tryLoadJson<{ tags: Record<string, string[]> }>(
    MERGED_V3
  );
  if (!merged?.tags) {
    return;
  }
  mergeTagFileIntoImport(accumulator, MERGED_V3, { tags: merged.tags });
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Errore import tag."}\n`
  );
  process.exitCode = 1;
});
