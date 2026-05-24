import { loadTaxonomyManifestItems } from "@/lib/asset-taxonomy-groups";
import {
  buildReviewOverrideEntries,
  isReviewStatus,
  memberGroupId,
  type ReviewMember,
  type TaxonomyReviewAction
} from "@/lib/asset-taxonomy-review";
import {
  countAssetOverrides,
  loadTaxonomyOverrides,
  mergeAssetOverrides,
  saveTaxonomyOverrides
} from "@/lib/taxonomy-overrides";

export const dynamic = "force-dynamic";

type RequestBody = {
  type?: unknown;
  groupId?: unknown;
  status?: unknown;
  macroCategory?: unknown;
  assetGroups?: unknown;
  themeTags?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json()) as RequestBody;
  const action = parseAction(body);

  if (!action) {
    return Response.json(
      { error: "Payload di review non valido." },
      { status: 400 }
    );
  }

  const [items, overrides] = await Promise.all([
    loadTaxonomyManifestItems(),
    loadTaxonomyOverrides()
  ]);

  const members: ReviewMember[] = items
    .filter((item) => memberGroupId(item) === action.groupId)
    .map((item) => ({
      assetGroups: item.assetGroups,
      macroCategory: item.macroCategory,
      path: item.path,
      status: item.status,
      themeTags: item.themeTags
    }));

  if (members.length === 0) {
    return Response.json(
      { error: "Gruppo semantico non trovato." },
      { status: 404 }
    );
  }

  const entries = buildReviewOverrideEntries(members, action);
  const saved = await saveTaxonomyOverrides(
    mergeAssetOverrides(overrides, entries)
  );

  return Response.json({
    changed: entries.length,
    memberCount: members.length,
    overrideCount: countAssetOverrides(saved),
    saved: true
  });
}

function parseAction(body: RequestBody): TaxonomyReviewAction | null {
  const type = typeof body.type === "string" ? body.type : "";
  const groupId = typeof body.groupId === "string" ? body.groupId : "";

  if (!groupId) {
    return null;
  }

  if (type === "confirm") {
    return { groupId, type };
  }

  if (type === "set-status" && isReviewStatus(body.status)) {
    return { groupId, status: body.status, type };
  }

  if (type === "correct") {
    const action: Extract<TaxonomyReviewAction, { type: "correct" }> = {
      groupId,
      type
    };
    if (typeof body.macroCategory === "string" && body.macroCategory) {
      action.macroCategory = body.macroCategory;
    }
    if (isStringArray(body.assetGroups)) {
      action.assetGroups = body.assetGroups;
    }
    if (isStringArray(body.themeTags)) {
      action.themeTags = body.themeTags;
    }
    if (isReviewStatus(body.status)) {
      action.status = body.status;
    }
    return action;
  }

  return null;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}
