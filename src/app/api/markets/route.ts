import { requireBlue, response, failure } from "@/lib/http";
import { listMarkets } from "@/lib/kalshi";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    requireBlue(request);
    const params = new URL(request.url).searchParams;
    return response(
      await listMarkets(
        params.get("cursor") || undefined,
        params.get("series") || undefined,
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
