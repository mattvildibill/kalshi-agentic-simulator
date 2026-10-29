import { requireBlue, response, failure, HttpError } from "@/lib/http";
import { readSnapshot } from "@/lib/storage";
export const runtime = "nodejs";
/** Full recoverable export includes original operation keys, so requires Blue authentication. */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireBlue(request);
    const { id } = await context.params;
    const snapshot = await readSnapshot();
    const archive = snapshot.archives?.find((a) => a.id === id);
    if (!archive)
      throw new HttpError(404, "RUN_NOT_FOUND", "Archived run not found.");
    return response(archive);
  } catch (error) {
    return failure(error);
  }
}
