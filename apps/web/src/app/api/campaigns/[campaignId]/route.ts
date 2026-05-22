import {
  CampaignNotFoundError,
  InvalidCampaignIdError,
  deleteCampaign,
  readCampaign,
  updateCampaign
} from "@/lib/campaigns";

type RouteContext = {
  params: Promise<{
    campaignId: string;
  }>;
};

type UpdateBody = {
  description?: unknown;
  maps?: unknown;
  name?: unknown;
  sessions?: unknown;
  tags?: unknown;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { campaignId } = await context.params;
    const campaign = await readCampaign(campaignId);
    return Response.json({ campaign, ok: true });
  } catch (error) {
    return campaignErrorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { campaignId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as UpdateBody;
    const patch: Parameters<typeof updateCampaign>[1] = {};

    if (typeof body.name === "string") {
      patch.name = body.name.trim();
    }

    if (typeof body.description === "string") {
      patch.description = body.description;
    }

    if (Array.isArray(body.tags)) {
      patch.tags = body.tags.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0
      );
    }

    if (Array.isArray(body.maps)) {
      patch.maps = body.maps as Parameters<typeof updateCampaign>[1]["maps"];
    }

    if (Array.isArray(body.sessions)) {
      patch.sessions = body.sessions as Parameters<
        typeof updateCampaign
      >[1]["sessions"];
    }

    const campaign = await updateCampaign(campaignId, patch);
    return Response.json({ campaign, ok: true });
  } catch (error) {
    return campaignErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { campaignId } = await context.params;
    await deleteCampaign(campaignId);
    return Response.json({ ok: true });
  } catch (error) {
    return campaignErrorResponse(error);
  }
}

function campaignErrorResponse(error: unknown): Response {
  if (error instanceof CampaignNotFoundError) {
    return Response.json({ error: error.message, ok: false }, { status: 404 });
  }

  if (error instanceof InvalidCampaignIdError) {
    return Response.json({ error: error.message, ok: false }, { status: 400 });
  }

  const message =
    error instanceof Error ? error.message : "Campaign operation failed.";
  return Response.json({ error: message, ok: false }, { status: 500 });
}
