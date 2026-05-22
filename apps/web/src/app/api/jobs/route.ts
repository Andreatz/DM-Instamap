import { fetchWorkerJobs } from "@/lib/worker-client";

export async function GET() {
  try {
    const jobs = await fetchWorkerJobs();
    return Response.json({ jobs, ok: true });
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
