import { scanAssets } from "../scanner";

const folder = process.argv[2];

if (!folder) {
  console.error("Usage: pnpm assets:scan <folder>");
  process.exit(1);
}

try {
  const outputRoot = process.env.INIT_CWD ?? process.cwd();
  const manifest = await scanAssets(folder, { outputRoot });
  console.log(
    `Scanned ${manifest.assets.length} assets with ${manifest.errors.length} errors. Manifest written to data/indexes/assets.manifest.json.`
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "Asset scan failed.");
  process.exit(1);
}
