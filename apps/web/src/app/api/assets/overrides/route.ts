import { saveAssetOverride } from "@/lib/asset-overrides";
import {
  buildCorrectionFromDraft,
  type AssetReviewDraft
} from "@/lib/asset-review";
import { loadAssetManifest } from "@/lib/assets-manifest";

export const dynamic = "force-dynamic";

type OverrideRequestBody = {
  assetId?: unknown;
  draft?: unknown;
  relativePath?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json()) as OverrideRequestBody;
  const assetId = typeof body.assetId === "string" ? body.assetId : "";
  const relativePath =
    typeof body.relativePath === "string" ? body.relativePath : "";

  if (!assetId || !relativePath || !isDraft(body.draft)) {
    return Response.json(
      { error: "Invalid asset override payload." },
      { status: 400 }
    );
  }

  const manifest = await loadAssetManifest();
  const asset = manifest.assets.find(
    (candidate) =>
      candidate.id === assetId && candidate.relativePath === relativePath
  );

  if (!asset) {
    return Response.json(
      { error: "Asset not found in manifest." },
      { status: 404 }
    );
  }

  const correction = buildCorrectionFromDraft(body.draft, asset);
  const overrides = await saveAssetOverride({
    assetId,
    correction,
    relativePath
  });

  return Response.json({
    override: overrides.overrides[assetId],
    saved: true
  });
}

function isDraft(value: unknown): value is AssetReviewDraft {
  if (!value || typeof value !== "object") {
    return false;
  }

  const draft = value as Record<string, unknown>;

  return (
    typeof draft.classification === "string" &&
    typeof draft.qualityScore === "number" &&
    typeof draft.tagsText === "string" &&
    typeof draft.theme === "string" &&
    typeof draft.usableForText === "string"
  );
}
