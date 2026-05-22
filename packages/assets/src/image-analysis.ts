import path from "node:path";
import sharp from "sharp";

export type LocalImageAnalysis = {
  dominantColors: Array<{
    hex: string;
    population: number;
  }>;
  format: string | null;
  height: number | null;
  imagePath: string;
  transparency: boolean | null;
  width: number | null;
};

export async function analyzeLocalImage(
  imagePath: string
): Promise<LocalImageAnalysis> {
  const image = sharp(imagePath, { limitInputPixels: false });
  const metadata = await image.metadata();
  const fallbackFormat = path.extname(imagePath).slice(1).toLowerCase() || null;

  return {
    dominantColors: await extractDominantColors(imagePath),
    format: metadata.format ?? fallbackFormat,
    height: metadata.height ?? null,
    imagePath,
    transparency: await detectTransparency(imagePath, metadata.hasAlpha),
    width: metadata.width ?? null
  };
}

async function extractDominantColors(
  filePath: string
): Promise<LocalImageAnalysis["dominantColors"]> {
  const { data } = await sharp(filePath, { limitInputPixels: false })
    .resize(32, 32, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const counts = new Map<string, number>();

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] ?? 0;

    if (alpha < 16) {
      continue;
    }

    const red = quantizeColor(data[index] ?? 0);
    const green = quantizeColor(data[index + 1] ?? 0);
    const blue = quantizeColor(data[index + 2] ?? 0);
    const hex = toHexColor(red, green, blue);
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([hex, population]) => ({ hex, population }))
    .sort(
      (left, right) =>
        right.population - left.population || left.hex.localeCompare(right.hex)
    )
    .slice(0, 5);
}

async function detectTransparency(
  filePath: string,
  hasAlpha?: boolean
): Promise<boolean | null> {
  if (hasAlpha === false) {
    return false;
  }

  if (hasAlpha !== true) {
    return null;
  }

  const { data } = await sharp(filePath, { limitInputPixels: false })
    .resize(64, 64, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let index = 3; index < data.length; index += 4) {
    if ((data[index] ?? 255) < 255) {
      return true;
    }
  }

  return false;
}

function quantizeColor(value: number): number {
  return Math.min(255, Math.round(value / 32) * 32);
}

function toHexColor(red: number, green: number, blue: number): string {
  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}
