import { getMarket, validTicker } from "@/lib/kalshi";
import { readSnapshot, updateSnapshot } from "@/lib/storage";
import {
  timingFromMarket,
  timingIsFresh,
  newerTiming,
} from "@/lib/market-timing";
import { response, failure, HttpError } from "@/lib/http";
export const runtime = "nodejs";
/** Public display cache for held markets only. Never calls settlement or trade code. */
async function loadTiming(ticker: string) {
  try {
    const snapshot = await readSnapshot();
    if (!snapshot.ledger.trades.some((trade) => trade.ticker === ticker))
      throw new HttpError(
        404,
        "POSITION_NOT_FOUND",
        "No recorded position for this market.",
      );
    const cached = snapshot.marketTimings?.[ticker];
    if (timingIsFresh(cached))
      return response({ timing: cached, stale: false });
    const retryAfter = Date.parse(
      snapshot.marketTimingRetryAfter?.[ticker] ?? "",
    );
    if (retryAfter > Date.now())
      return response(
        {
          timing: cached ?? null,
          stale: true,
          error: "Could not refresh the official schedule.",
        },
        cached ? 200 : 503,
      );
    try {
      const observedAt = new Date().toISOString();
      const market = await getMarket(ticker);
      const next = timingFromMarket(market, observedAt);
      const timing = await updateSnapshot((current) => {
        if (!current.ledger.trades.some((trade) => trade.ticker === ticker))
          throw new HttpError(
            404,
            "POSITION_NOT_FOUND",
            "No recorded position for this market.",
          );
        const selected = newerTiming(current.marketTimings?.[ticker], next);
        return {
          snapshot: {
            ...current,
            marketTimings: { ...current.marketTimings, [ticker]: selected },
          },
          result: selected,
        };
      });
      return response({ timing, stale: !timingIsFresh(timing) });
    } catch {
      // Back off failed upstream requests across server instances without changing evidence freshness.
      try {
        await updateSnapshot((current) => ({
          snapshot: {
            ...current,
            marketTimingRetryAfter: {
              ...current.marketTimingRetryAfter,
              [ticker]: new Date(Date.now() + 60000).toISOString(),
            },
          },
          result: null,
        }));
      } catch {
        /* Preserve readable cached data if storage also fails. */
      }
      return response(
        {
          timing: cached ?? null,
          stale: true,
          error: "Could not refresh the official schedule.",
        },
        cached ? 200 : 503,
      );
    }
  } catch (error) {
    return failure(error);
  }
}

const pending = new Map<string, Promise<Response>>();
export async function GET(
  _request: Request,
  context: { params: Promise<{ ticker: string }> },
) {
  try {
    const ticker = validTicker((await context.params).ticker);
    let task = pending.get(ticker);
    if (!task) {
      task = loadTiming(ticker).finally(() => pending.delete(ticker));
      pending.set(ticker, task);
    }
    return (await task).clone();
  } catch (error) {
    return failure(error);
  }
}
