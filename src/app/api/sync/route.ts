import { requireActiveRun } from "@/lib/runs";
import { requireBlue, response, failure } from "@/lib/http";
import { readSnapshot } from "@/lib/storage";
import { synchronize } from "@/lib/sync";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    requireBlue(request);
    const activeId = requireActiveRun(request, await readSnapshot());
    const cursor = new URL(request.url).searchParams.get("cursor");
    return response(await synchronize(activeId, cursor));
  } catch (error) {
    return failure(error);
  }
}
