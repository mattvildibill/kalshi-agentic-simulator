import { executeTrade } from "@/lib/engine";
import {
  requireBlue,
  parseBody,
  tradeSchema,
  response,
  failure,
} from "@/lib/http";
import { getQuote } from "@/lib/kalshi";
import { readSnapshot, updateSnapshot } from "@/lib/storage";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireBlue(request);
    const input = await parseBody(request, tradeSchema);
    const snapshot = await readSnapshot();
    const existing = snapshot.ledger.trades.find(
      (t) => t.idempotencyKey === input.idempotencyKey,
    );
    // Successful retries must not depend on a still-open market or upstream availability.
    if (existing) {
      const result = executeTrade(snapshot.ledger, input, existing.quote);
      return response({ trade: result.trade, replayed: true });
    }
    const { quote } = await getQuote(input.ticker);
    const result = await updateSnapshot((current) => {
      const { state, trade, replayed } = executeTrade(
        current.ledger,
        input,
        quote,
      );
      const existingMark = current.marks[quote.ticker];
      const mark =
        existingMark &&
        Date.parse(existingMark.observedAt) > Date.parse(quote.observedAt)
          ? existingMark
          : quote;
      return {
        snapshot: {
          ...current,
          ledger: state,
          marks: { ...current.marks, [quote.ticker]: mark },
        },
        result: { trade, replayed },
      };
    });
    return response(result, result.replayed ? 200 : 201);
  } catch (error) {
    return failure(error);
  }
}
