import { requireBlue, response, failure } from "@/lib/http";
import { readSnapshot } from "@/lib/storage";
import { activeRun } from "@/lib/runs";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    requireBlue(request);
    const snapshot = await readSnapshot();
    return response({
      activeRun: activeRun(snapshot),
      archives: (snapshot.archives ?? []).map(
        ({ snapshot: _snapshot, ...metadata }) => metadata,
      ),
    });
  } catch (error) {
    return failure(error);
  }
}
