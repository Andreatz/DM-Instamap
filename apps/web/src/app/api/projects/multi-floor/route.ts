import { createMultiFloorProjects, toProjectSummary } from "@/lib/projects";

type MultiFloorRequest = {
  baseSlug?: unknown;
  documents?: unknown;
  name?: unknown;
  selectedAssetGroupIds?: unknown;
  selectedReferenceIds?: unknown;
  sourceRequest?: unknown;
  styleDnaIds?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as MultiFloorRequest;
    const documents = Array.isArray(body.documents) ? body.documents : [];

    if (documents.length === 0) {
      return Response.json(
        {
          error: "documents array is required.",
          ok: false
        },
        { status: 400 }
      );
    }

    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : "Multi-floor Dungeon";
    const baseSlug =
      typeof body.baseSlug === "string" && body.baseSlug.trim()
        ? body.baseSlug.trim()
        : name;

    const projects = await createMultiFloorProjects({
      baseSlug,
      documents,
      name,
      selectedAssetGroupIds: body.selectedAssetGroupIds,
      selectedReferenceIds: body.selectedReferenceIds,
      sourceRequest: body.sourceRequest,
      styleDnaIds: body.styleDnaIds
    });

    return Response.json(
      {
        ok: true,
        projects: projects.map(toProjectSummary)
      },
      { status: 201 }
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create multi-floor projects.",
        ok: false
      },
      { status: 400 }
    );
  }
}
