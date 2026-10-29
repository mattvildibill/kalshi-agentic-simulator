import { addResearch } from "@/lib/engine";
import {
  requireBlue,
  parseBody,
  researchSchema,
  response,
  failure,
} from "@/lib/http";
import { updateSnapshot } from "@/lib/storage";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireBlue(request);
    const input = await parseBody(request, researchSchema);
    const result = await updateSnapshot((snapshot) => {
      const { state, research, replayed } = addResearch(snapshot.ledger, input);
      return {
        snapshot: { ...snapshot, ledger: state },
        result: { research, replayed },
      };
    });
    return response(result, result.replayed ? 200 : 201);
  } catch (error) {
    return failure(error);
  }
}
