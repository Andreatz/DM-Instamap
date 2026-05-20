import { createCampaignProject, listCampaigns } from "@/lib/campaigns";

type CreateCampaignBody = {
  description?: unknown;
  name?: unknown;
  tags?: unknown;
};

export async function GET() {
  try {
    const campaigns = await listCampaigns();
    return Response.json({ campaigns, ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not list campaigns.";
    return Response.json({ error: message, ok: false }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as CreateCampaignBody;
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return Response.json({ error: "Campaign name is required.", ok: false }, { status: 400 });
    }

    const tags = Array.isArray(body.tags)
      ? body.tags.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];
    const description = typeof body.description === "string" ? body.description : undefined;
    const campaign = await createCampaignProject({ description, name, tags });

    return Response.json({ campaign, ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create campaign.";
    return Response.json({ error: message, ok: false }, { status: 500 });
  }
}
