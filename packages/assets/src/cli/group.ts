import { groupAssets } from "../groups";

try {
  const outputRoot = process.env.INIT_CWD ?? process.cwd();
  const groupsFile = await groupAssets({ outputRoot });
  console.log(
    `Created ${groupsFile.groupCount} asset groups. Index written to data/indexes/asset-groups.json.`
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Asset grouping failed."
  );
  process.exit(1);
}
