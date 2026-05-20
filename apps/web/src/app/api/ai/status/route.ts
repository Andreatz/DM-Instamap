import { getBridgeStatus } from "@dm-instamap/ai-bridge";

export async function GET() {
  const status = getBridgeStatus(process.env);
  return Response.json({ ok: true, status });
}
