import { scanReferences } from "../references";

const folder = process.argv[2];

if (!folder) {
  console.error("Usage: pnpm references:scan <folder>");
  process.exit(1);
}

try {
  const outputRoot = process.env.INIT_CWD ?? process.cwd();
  const manifest = await scanReferences(folder, { outputRoot });
  console.log(
    `Scanned ${manifest.references.length} reference maps with ${manifest.errors.length} errors. Manifest written to data/indexes/references.manifest.json.`
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "Reference scan failed.");
  process.exit(1);
}
