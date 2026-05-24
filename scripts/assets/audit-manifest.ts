/**
 * `pnpm assets:audit-manifest`
 *
 * Audits the mapped assets (preferring the metadata-enriched file) and writes
 * `data/assets/reports/audit-report.json` + `audit-report.md` with counts and
 * the first examples per check.
 */

import {
  type AssetManifestItem,
  auditManifest,
  renderAuditMarkdown,
  TAXONOMY_PATHS
} from "../../packages/assets/src/taxonomy/index.ts";
import { logLine, saveJson, saveText, tryLoadJson } from "./_shared.ts";

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

  const report = auditManifest(source.assets);
  await saveJson(TAXONOMY_PATHS.auditJson, report, { pretty: true });
  await saveText(TAXONOMY_PATHS.auditMarkdown, renderAuditMarkdown(report));

  logLine(`Audit di ${report.totalAssets} asset:`);
  for (const check of report.checks) {
    if (check.count > 0) {
      logLine(`  - ${check.label}: ${check.count}`);
    }
  }
  logLine(`Output: ${TAXONOMY_PATHS.auditJson}`);
  logLine(`Output: ${TAXONOMY_PATHS.auditMarkdown}`);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Errore audit-manifest."}\n`
  );
  process.exitCode = 1;
});
