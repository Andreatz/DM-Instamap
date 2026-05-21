import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BridgeAssetGroupSummary, BridgeReferenceSummary } from "../index";

type AssetGroupsFile = {
  groups?: unknown;
};

type ReferencesManifestFile = {
  references?: unknown;
};

type ReferenceStyleDnaFile = {
  styles?: unknown;
};

export async function loadBridgeContextFromIndexes(outputRoot: string): Promise<{
  assetGroups: BridgeAssetGroupSummary[];
  references: BridgeReferenceSummary[];
}> {
  const indexesRoot = path.join(outputRoot, "data", "indexes");
  const [assetGroups, references] = await Promise.all([
    loadAssetGroups(path.join(indexesRoot, "asset-groups.json")),
    loadReferences(path.join(indexesRoot, "references.manifest.json"), path.join(indexesRoot, "reference-style-dna.json"))
  ]);

  return { assetGroups, references };
}

async function loadAssetGroups(filePath: string): Promise<BridgeAssetGroupSummary[]> {
  const file = (await readJsonFile(filePath)) as AssetGroupsFile | null;
  const groups = Array.isArray(file?.groups) ? file.groups : [];

  return groups
    .map<BridgeAssetGroupSummary | null>((group) => {
      if (!group || typeof group !== "object") {
        return null;
      }

      const input = group as Record<string, unknown>;
      const id = readString(input.id);
      const name = readString(input.name);

      if (!id || !name) {
        return null;
      }

      const summary: BridgeAssetGroupSummary = {
        assetCount: readNumber(input.assetCount) ?? readStringArray(input.assetIds).length,
        id,
        kind: readString(input.kind) || "unknown",
        name,
        qualityScore: readNumber(input.qualityScore),
        tags: readStringArray(input.tags),
        theme: readString(input.theme) || null,
        usableFor: readStringArray(input.usableFor)
      };

      return summary;
    })
    .filter((group): group is BridgeAssetGroupSummary => group !== null);
}

async function loadReferences(manifestPath: string, stylePath: string): Promise<BridgeReferenceSummary[]> {
  const [manifest, stylesByReferenceId] = await Promise.all([
    readJsonFile(manifestPath) as Promise<ReferencesManifestFile | null>,
    loadStylesByReferenceId(stylePath)
  ]);
  const references = Array.isArray(manifest?.references) ? manifest.references : [];

  return references
    .map<BridgeReferenceSummary | null>((reference) => {
      if (!reference || typeof reference !== "object") {
        return null;
      }

      const input = reference as Record<string, unknown>;
      const id = readString(input.id);
      const referencePath = readString(input.path);

      if (!id || !referencePath) {
        return null;
      }

      const summary: BridgeReferenceSummary = {
        height: readNumber(input.height),
        id,
        mapType: readString(input.mapType) || "unknown",
        mapTypeConfidence: readNumber(input.mapTypeConfidence) ?? undefined,
        path: referencePath,
        styleDna: stylesByReferenceId.get(id) ?? null,
        tags: readStringArray(input.tags),
        width: readNumber(input.width)
      };

      return summary;
    })
    .filter((reference): reference is BridgeReferenceSummary => reference !== null);
}

async function loadStylesByReferenceId(filePath: string): Promise<Map<string, NonNullable<BridgeReferenceSummary["styleDna"]>>> {
  const file = (await readJsonFile(filePath)) as ReferenceStyleDnaFile | null;
  const styles = Array.isArray(file?.styles) ? file.styles : [];
  const byReferenceId = new Map<string, NonNullable<BridgeReferenceSummary["styleDna"]>>();

  for (const style of styles) {
    if (!style || typeof style !== "object") {
      continue;
    }

    const input = style as Record<string, unknown>;
    const referenceId = readString(input.referenceId);

    if (!referenceId) {
      continue;
    }

    byReferenceId.set(referenceId, {
      density: readString(input.density) || "medium",
      layoutTraits: readStringArray(input.layoutTraits),
      mood: readStringArray(input.mood),
      promptSummary: readString(input.promptSummary),
      recommendedAssetTags: readStringArray(input.recommendedAssetTags),
      visualTags: readStringArray(input.visualTags)
    });
  }

  return byReferenceId;
}

async function readJsonFile(filePath: string): Promise<unknown | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
