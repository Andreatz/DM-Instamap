import { saveAssetOverrides } from "@/lib/asset-overrides";
import { loadAssetManifest } from "@/lib/assets-manifest";
import { loadAssetGroups } from "@/lib/asset-groups";
import {
  applyGroupReviewAction,
  buildAssetCorrectionsForGroup,
  buildGroupCorrectionFromDraft,
  buildGroupReviewItems,
  loadAssetGroupReviews,
  saveAssetGroupReviews,
  type AssetGroupReviewDraft,
  type BatchGroupAction
} from "@/lib/asset-group-review";

export const dynamic = "force-dynamic";

type RequestBody = {
  action?: unknown;
  assetId?: unknown;
  assetIds?: unknown;
  draft?: unknown;
  groupId?: unknown;
  groupIds?: unknown;
  name?: unknown;
  tagsText?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json()) as RequestBody;
  const action = parseAction(body);

  if (!action) {
    return Response.json(
      { error: "Invalid group review payload." },
      { status: 400 }
    );
  }

  const [groups, manifest, reviews] = await Promise.all([
    loadAssetGroups(),
    loadAssetManifest(),
    loadAssetGroupReviews()
  ]);
  const items = buildGroupReviewItems(groups.groups, manifest.assets, reviews);
  const item =
    "groupId" in action
      ? items.find((candidate) => candidate.group.id === action.groupId)
      : null;

  if ("groupId" in action && !item) {
    return Response.json({ error: "Asset group not found." }, { status: 404 });
  }

  if (action.action === "correct" && item) {
    const correction = buildGroupCorrectionFromDraft(action.draft);
    await saveAssetOverrides(
      buildAssetCorrectionsForGroup(item, correction).map(
        ({ asset, correction: assetCorrection }) => ({
          assetId: asset.id,
          correction: assetCorrection,
          relativePath: asset.relativePath
        })
      )
    );
  }

  if (action.action === "add-tags" && item) {
    const existingDraft = {
      kind: item.review?.correction?.kind ?? item.group.kind,
      qualityScore:
        item.review?.correction?.qualityScore ?? item.group.qualityScore ?? 50,
      tagsText: [
        ...new Set([
          ...item.group.tags,
          ...action.tagsText
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        ])
      ].join(", "),
      theme: item.review?.correction?.theme ?? item.group.theme ?? "",
      usableForText: (
        item.review?.correction?.usableFor ?? item.group.usableFor
      ).join(", ")
    } as AssetGroupReviewDraft;
    const correction = buildGroupCorrectionFromDraft(existingDraft);
    await saveAssetOverrides(
      buildAssetCorrectionsForGroup(item, correction).map(
        ({ asset, correction: assetCorrection }) => ({
          assetId: asset.id,
          correction: assetCorrection,
          relativePath: asset.relativePath
        })
      )
    );
  }

  const savedReviews = await saveAssetGroupReviews(
    applyGroupReviewAction(reviews, action)
  );

  return Response.json({
    reviews: savedReviews,
    saved: true
  });
}

function parseAction(body: RequestBody): BatchGroupAction | null {
  const action = typeof body.action === "string" ? body.action : "";
  const groupId = typeof body.groupId === "string" ? body.groupId : "";

  if (action === "confirm" && groupId) {
    return { action, groupId };
  }

  if (action === "correct" && groupId && isDraft(body.draft)) {
    return { action, draft: body.draft, groupId };
  }

  if (action === "add-tags" && groupId && typeof body.tagsText === "string") {
    return { action, groupId, tagsText: body.tagsText };
  }

  if (
    action === "remove-asset" &&
    groupId &&
    typeof body.assetId === "string"
  ) {
    return { action, assetId: body.assetId, groupId };
  }

  if (
    action === "split" &&
    groupId &&
    typeof body.name === "string" &&
    Array.isArray(body.assetIds)
  ) {
    const assetIds = body.assetIds.filter(
      (assetId): assetId is string => typeof assetId === "string"
    );
    return assetIds.length > 0
      ? { action, assetIds, groupId, name: body.name }
      : null;
  }

  if (
    action === "merge" &&
    typeof body.name === "string" &&
    Array.isArray(body.groupIds)
  ) {
    const groupIds = body.groupIds.filter(
      (assetId): assetId is string => typeof assetId === "string"
    );
    return groupIds.length >= 2 ? { action, groupIds, name: body.name } : null;
  }

  return null;
}

function isDraft(value: unknown): value is AssetGroupReviewDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const draft = value as Record<string, unknown>;

  return (
    typeof draft.kind === "string" &&
    typeof draft.qualityScore === "number" &&
    typeof draft.tagsText === "string" &&
    typeof draft.theme === "string" &&
    typeof draft.usableForText === "string"
  );
}
