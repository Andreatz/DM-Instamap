import {
  createProviderFromEnv,
  describeMapWithAi
} from "@dm-instamap/ai-bridge";

type DescribeRequest = {
  mapName?: unknown;
  rooms?: unknown;
  styleTags?: unknown;
  theme?: unknown;
};

export async function POST(request: Request) {
  try {
    const provider = createProviderFromEnv(process.env);

    if (!provider) {
      return Response.json(
        {
          error:
            "AI provider not configured. Set AI_PROVIDER and AI_API_KEY in your environment.",
          ok: false
        },
        { status: 503 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as DescribeRequest;
    const mapName = typeof body.mapName === "string" ? body.mapName : "";

    if (!mapName.trim()) {
      return Response.json(
        { error: "mapName is required.", ok: false },
        { status: 400 }
      );
    }

    const rooms = Array.isArray(body.rooms)
      ? body.rooms.filter(
          (room): room is { id: string; label: string; tags?: string[] } => {
            if (!room || typeof room !== "object") {
              return false;
            }
            const candidate = room as { id?: unknown; label?: unknown };
            return (
              typeof candidate.id === "string" &&
              typeof candidate.label === "string"
            );
          }
        )
      : [];
    const styleTags = Array.isArray(body.styleTags)
      ? body.styleTags.filter((tag): tag is string => typeof tag === "string")
      : undefined;
    const theme = typeof body.theme === "string" ? body.theme : undefined;

    const result = await describeMapWithAi(
      { mapName, rooms, styleTags, theme },
      provider
    );

    if (!result.ok) {
      return Response.json(
        {
          errors: result.errors,
          ok: false,
          providerId: result.providerId
        },
        { status: 422 }
      );
    }

    return Response.json({
      description: result.description,
      ok: true,
      providerId: result.providerId
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI description failed.";
    return Response.json({ error: message, ok: false }, { status: 500 });
  }
}
