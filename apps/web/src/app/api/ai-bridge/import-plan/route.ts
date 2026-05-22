import {
  buildChatGptBridgePrompt,
  repairPlanLocally,
  validateBridgeResponse,
  validatePlanSemantics,
  type BridgeAssetGroupSummary,
  type BridgeAssetSearchSummary,
  type BridgeReferenceSummary
} from "@dm-instamap/ai-bridge";
import {
  convertPlanToMapDocument,
  type ImportPlanMode
} from "@/lib/ai-bridge-import";
import { loadAssetGroups } from "@/lib/asset-groups";
import { loadReferenceMaps } from "@/lib/references";
import {
  createProject,
  readProject,
  updateProject,
  createProjectSlug,
  ProjectNotFoundError
} from "@/lib/projects";

type ImportPlanRequest = {
  applyAutoRepair?: unknown;
  documentName?: unknown;
  mode?: unknown;
  projectId?: unknown;
  response?: unknown;
  selectedAssetGroupIds?: unknown;
  selectedReferenceIds?: unknown;
  sourceRequest?: unknown;
  styleDnaIds?: unknown;
  userRequest?: unknown;
};

export async function POST(request: Request) {
  let body: ImportPlanRequest;

  try {
    body = (await request.json()) as ImportPlanRequest;
  } catch {
    return Response.json(
      { error: "Request body must be JSON.", ok: false },
      { status: 400 }
    );
  }

  const mode = parseMode(body.mode);

  if (!mode) {
    return Response.json(
      { error: "mode must be new-project or update-project.", ok: false },
      { status: 400 }
    );
  }

  const responseText = typeof body.response === "string" ? body.response : "";

  if (!responseText.trim()) {
    return Response.json(
      { error: "response is required.", ok: false },
      { status: 400 }
    );
  }

  const validation = validateBridgeResponse(responseText);

  if (!validation.ok) {
    return Response.json(
      { errors: validation.errors, ok: false },
      { status: 400 }
    );
  }

  const userRequest =
    typeof body.userRequest === "string" ? body.userRequest : "";
  const [assetGroupsView, referencesView] = await Promise.all([
    loadAssetGroups(),
    loadReferenceMaps()
  ]);
  const assetGroupSummaries: BridgeAssetGroupSummary[] =
    assetGroupsView.groups.map((group) => ({
      assetCount: group.assetCount,
      id: group.id,
      kind: group.kind,
      name: group.name,
      qualityScore: group.qualityScore,
      tags: group.tags,
      theme: group.theme,
      usableFor: group.usableFor
    }));
  const referenceSummaries: BridgeReferenceSummary[] =
    referencesView.references.map((reference) => ({
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
    }));
  const knownAssetIds = collectKnownAssetIds(assetGroupsView.groups);
  const applyAutoRepair =
    body.applyAutoRepair === false
      ? false
      : Boolean(body.applyAutoRepair ?? true);

  try {
    const projectIdHint =
      typeof body.projectId === "string" ? body.projectId : null;
    const documentName =
      typeof body.documentName === "string" ? body.documentName : undefined;
    const sourceProject =
      mode === "update-project" && projectIdHint
        ? await readProject(projectIdHint)
        : null;
    const mapWidth = sourceProject?.document.width;
    const mapHeight = sourceProject?.document.height;
    const initialContext = {
      assetGroups: assetGroupSummaries,
      assetSearchResults: [] as BridgeAssetSearchSummary[],
      knownAssetIds,
      mapHeight,
      mapWidth
    };
    const initialIssues = validatePlanSemantics(
      validation.data,
      initialContext
    );
    let plan = validation.data;
    let repairSummary: ReturnType<typeof repairPlanLocally> | null = null;

    if (applyAutoRepair && !initialIssues.ok) {
      repairSummary = repairPlanLocally({ context: initialContext, plan });
      plan = repairSummary.plan;
    }

    const conversion = convertPlanToMapDocument({
      documentId: projectIdHint
        ? projectIdHint
        : createProjectSlug(
            documentName ?? plan.name ?? userRequest ?? "imported-plan"
          ),
      documentName,
      mode,
      plan,
      source: sourceProject?.document ?? null
    });
    const semantics = validatePlanSemantics(plan, {
      ...initialContext,
      mapHeight: conversion.document.height,
      mapWidth: conversion.document.width
    });

    if (mode === "update-project") {
      if (!projectIdHint) {
        return Response.json(
          {
            error: "projectId is required for update-project mode.",
            ok: false
          },
          { status: 400 }
        );
      }

      const updated = await updateProject(projectIdHint, {
        document: conversion.document,
        name: documentName,
        selectedAssetGroupIds: parseStringArray(body.selectedAssetGroupIds),
        selectedReferenceIds: parseStringArray(body.selectedReferenceIds),
        sourceRequest:
          typeof body.sourceRequest === "string"
            ? body.sourceRequest
            : undefined,
        styleDnaIds: parseStringArray(body.styleDnaIds)
      });

      return Response.json({
        appliedRepair: repairSummary,
        issues: semantics.issues,
        missingAssets: semantics.missingAssets,
        ok: true,
        project: { id: updated.id, name: updated.name },
        referenceMaps: referenceSummaries.length,
        usedPromptPreview: buildChatGptBridgePrompt({
          assetGroups: assetGroupSummaries,
          references: referenceSummaries,
          userRequest
        }).slice(0, 1200)
      });
    }

    const created = await createProject({
      document: conversion.document,
      name: documentName ?? plan.name,
      selectedAssetGroupIds: parseStringArray(body.selectedAssetGroupIds),
      selectedReferenceIds: parseStringArray(body.selectedReferenceIds),
      sourceRequest:
        typeof body.sourceRequest === "string"
          ? body.sourceRequest
          : userRequest,
      styleDnaIds: parseStringArray(body.styleDnaIds)
    });

    return Response.json(
      {
        appliedRepair: repairSummary,
        issues: semantics.issues,
        missingAssets: semantics.missingAssets,
        ok: true,
        project: { id: created.id, name: created.name },
        referenceMaps: referenceSummaries.length
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      return Response.json(
        { error: error.message, ok: false },
        { status: 404 }
      );
    }

    const message = error instanceof Error ? error.message : "Import failed.";
    return Response.json({ error: message, ok: false }, { status: 400 });
  }
}

function parseMode(value: unknown): ImportPlanMode | null {
  return value === "new-project" || value === "update-project" ? value : null;
}

function parseStringArray(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    return [value];
  }

  return [];
}

function collectKnownAssetIds(
  groups: Array<{ assetIds: string[]; id: string }>
): string[] {
  const ids = new Set<string>();

  for (const group of groups) {
    ids.add(group.id);
    for (const assetId of group.assetIds ?? []) {
      ids.add(assetId);
    }
  }

  return [...ids];
}
