import { generateAssetEmbeddings } from "../embeddings";

try {
  const outputRoot = process.env.INIT_CWD ?? process.cwd();
  const index = await generateAssetEmbeddings({ outputRoot });
  console.log(
    `Generated ${index.vectors.length} local asset embeddings. Index written to data/indexes/asset-embeddings.json.`
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "Asset embedding generation failed.");
  process.exit(1);
}
