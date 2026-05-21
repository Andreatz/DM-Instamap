import type { BridgeAssetGroupSummary, BridgeReferenceSummary } from "@dm-instamap/ai-bridge";
import type { AssetGroupView } from "./asset-groups";
import type { ReferenceMapView } from "./references";

export function toBridgeAssetGroup(group: AssetGroupView): BridgeAssetGroupSummary {
  return {
    assetCount: group.assetCount,
    id: group.id,
    kind: group.kind,
    name: group.name,
    qualityScore: group.qualityScore,
    tags: group.tags,
    theme: group.theme,
    usableFor: group.usableFor
  };
}

export function toBridgeReference(reference: ReferenceMapView): BridgeReferenceSummary {
  return {
    height: reference.height,
    id: reference.id,
    mapType: reference.mapType,
    mapTypeConfidence: reference.mapTypeConfidence,
    path: reference.path,
    styleDna: reference.styleDna
      ? {
          density: reference.styleDna.density,
          layoutTraits: reference.styleDna.layoutTraits,
          mood: reference.styleDna.mood,
          promptSummary: reference.styleDna.promptSummary,
          recommendedAssetTags: reference.styleDna.recommendedAssetTags,
          visualTags: reference.styleDna.visualTags
        }
      : null,
    tags: reference.tags,
    width: reference.width
  };
}
