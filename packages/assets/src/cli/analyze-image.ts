import { analyzeLocalImage } from "../image-analysis";

const imagePath = process.argv[2];

if (!imagePath) {
  console.error("Usage: pnpm assets:analyze-image <image>");
  process.exit(1);
}

try {
  const analysis = await analyzeLocalImage(imagePath);
  process.stdout.write(`${JSON.stringify(analysis, null, 2)}\n`);
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Image analysis failed."
  );
  process.exit(1);
}
