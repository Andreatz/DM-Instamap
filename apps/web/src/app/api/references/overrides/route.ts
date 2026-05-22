import { saveReferenceOverride } from "@/lib/reference-overrides";
import {
  buildReferenceCorrectionFromDraft,
  type ReferenceReviewDraft
} from "@/lib/reference-review";
import { loadReferenceMaps } from "@/lib/references";

export const dynamic = "force-dynamic";

type OverrideRequestBody = {
  draft?: unknown;
  referenceId?: unknown;
  referencePath?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json()) as OverrideRequestBody;
  const referenceId =
    typeof body.referenceId === "string" ? body.referenceId : "";
  const referencePath =
    typeof body.referencePath === "string" ? body.referencePath : "";

  if (!referenceId || !referencePath || !isDraft(body.draft)) {
    return Response.json(
      { error: "Invalid reference override payload." },
      { status: 400 }
    );
  }

  const manifest = await loadReferenceMaps();
  const reference = manifest.references.find(
    (candidate) =>
      candidate.id === referenceId && candidate.path === referencePath
  );

  if (!reference) {
    return Response.json(
      { error: "Reference not found in manifest." },
      { status: 404 }
    );
  }

  const correction = buildReferenceCorrectionFromDraft(body.draft);
  const overrides = await saveReferenceOverride({
    correction,
    referenceId,
    referencePath
  });

  return Response.json({
    override: overrides.overrides[referenceId],
    saved: true
  });
}

function isDraft(value: unknown): value is ReferenceReviewDraft {
  if (!value || typeof value !== "object") {
    return false;
  }

  const draft = value as Record<string, unknown>;

  return (
    typeof draft.layoutTagsText === "string" &&
    typeof draft.mapType === "string" &&
    typeof draft.notes === "string" &&
    typeof draft.qualityScore === "number" &&
    typeof draft.styleTagsText === "string" &&
    typeof draft.themeTagsText === "string"
  );
}
