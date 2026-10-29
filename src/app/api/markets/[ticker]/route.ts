import { requireBlue, response, failure } from "@/lib/http";
import { getQuote } from "@/lib/kalshi";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ ticker: string }> },
) {
  try {
    requireBlue(request);
    return response(await getQuote((await context.params).ticker));
  } catch (error) {
    return failure(error);
  }
}
