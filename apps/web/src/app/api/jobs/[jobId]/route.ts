import { fetchWorkerJob } from "@/lib/worker-client";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const job = await fetchWorkerJob(jobId);
    return Response.json({ job, ok: true });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Worker unreachable.",
        ok: false
      },
      { status: 502 }
    );
  }
}
