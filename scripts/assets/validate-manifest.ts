/**
 * `pnpm assets:validate [-- --max-unknown 0.1]`
 *
 * Validates `data/assets/asset-manifest.json`. Exits with a non-zero code when
 * any hard rule fails (suspicious lights, too many unknown, missing core
 * categories, empty manifest, missing id/path, duplicate ids).
 */

import {
  type AssetManifest,
  TAXONOMY_PATHS,
  validateManifest
} from "../../packages/assets/src/taxonomy/index.ts";
import { failWith, loadJson, logLine, parseCliArgs } from "./_shared.ts";

async function main(): Promise<void> {
  const { flags } = parseCliArgs(process.argv.slice(2));
  const maxUnknownRatio =
    typeof flags["max-unknown"] === "string"
      ? Number.parseFloat(flags["max-unknown"])
      : undefined;

  let manifest: AssetManifest;
  try {
    manifest = await loadJson<AssetManifest>(TAXONOMY_PATHS.finalManifest);
  } catch {
    failWith(
      `Manifest finale non trovato (${TAXONOMY_PATHS.finalManifest}). Esegui prima assets:manifest.`
    );
  }

  const result = validateManifest(manifest.assets, { maxUnknownRatio });

  for (const warning of result.warnings) {
    logLine(`⚠️  ${warning.code}: ${warning.message}`);
  }

  if (result.ok) {
    logLine(`✅ Manifest valido (${manifest.assets.length} asset).`);
    return;
  }

  process.stderr.write("❌ Validazione manifest fallita:\n");
  for (const error of result.errors) {
    process.stderr.write(`  - ${error.code}: ${error.message}\n`);
    for (const example of error.examples ?? []) {
      process.stderr.write(`      ${example}\n`);
    }
  }
  process.exit(1);
}

main().catch((error: unknown) => {
  failWith(
    error instanceof Error ? error.message : "Errore validate-manifest."
  );
});
