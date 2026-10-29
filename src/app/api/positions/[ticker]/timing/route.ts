import { activeRun, assertRun } from "@/lib/runs";
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
async function loadTiming(ticker: string, expectedRunId: string | null) {
  try {
    const snapshot = await readSnapshot();
    const runId = activeRun(snapshot).id;
    if ((snapshot.activeRun || expectedRunId) && expectedRunId !== runId)
      throw new HttpError(
        409,
        "RUN_MISMATCH",
        "This schedule request belongs to a different portfolio run.",
      );
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
        assertRun(current, runId);
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
      assertRun(await readSnapshot(), runId);
      // Back off failed upstream requests across server instances without changing evidence freshness.
      try {
        await updateSnapshot((current) => {
          assertRun(current, runId);
          return {
            snapshot: {
              ...current,
              marketTimingRetryAfter: {
                ...current.marketTimingRetryAfter,
                [ticker]: new Date(Date.now() + 60000).toISOString(),
              },
            },
            result: null,
          };
        });
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
    const expectedRunId = new URL(_request.url).searchParams.get("runId");
    const pendingKey = `${expectedRunId}:${ticker}`;
    let task = pending.get(pendingKey);
    if (!task) {
      task = loadTiming(ticker, expectedRunId).finally(() =>
        pending.delete(pendingKey),
      );
      pending.set(pendingKey, task);
    }
    return (await task).clone();
  } catch (error) {
    return failure(error);
  }
}
