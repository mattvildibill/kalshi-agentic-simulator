import { requireActiveRun, assertRun } from "@/lib/runs";
import {
  timingFromMarket,
  newerTiming,
  type MarketTiming,
} from "@/lib/market-timing";
import { randomUUID } from "node:crypto";
import {
  settleMarket,
  type MarketQuote,
  type SettlementInput,
} from "@/lib/engine";
import { requireBlue, response, failure, HttpError } from "@/lib/http";
import { getMarket, getQuote, settlementFromMarket } from "@/lib/kalshi";
import { readSnapshot, updateSnapshot } from "@/lib/storage";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    requireBlue(request);
    const activeId = requireActiveRun(request, await readSnapshot());
    const cursor = new URL(request.url).searchParams.get("cursor");
    // The opaque cursor identifies a persisted run, not a caller-chosen offset.
    const runId = randomUUID();
    const work = await updateSnapshot((snapshot) => {
      assertRun(snapshot, activeId);
      if (cursor && snapshot.syncRun?.id !== cursor)
        throw new HttpError(
          409,
          "INVALID_SYNC_CURSOR",
          "This synchronization cursor is no longer active; start a new sync.",
        );
      const tickers = [
        ...new Set(
          snapshot.ledger.trades
            .filter((t) => t.status === "open")
            .map((t) => t.ticker),
        ),
      ].sort();
      const run = snapshot.syncRun || {
        id: runId,
        pendingTickers: tickers,
        startedAt: new Date().toISOString(),
      };
      const errors = snapshot.syncRun
        ? snapshot.lastSyncErrors
        : snapshot.lastSyncErrors.filter((e) => tickers.includes(e.ticker));
      return {
        snapshot: { ...snapshot, syncRun: run, lastSyncErrors: errors },
        result: { id: run.id, batch: run.pendingTickers.slice(0, 10) },
      };
    });
    const results: {
      ticker: string;
      quote?: MarketQuote;
      timing?: MarketTiming;
      settlement?: SettlementInput;
      error?: string;
    }[] = [];
    // Bound upstream concurrency and work per serverless request. Continue via cursor.
    for (let offset = 0; offset < work.batch.length; offset += 5) {
      results.push(
        ...(await Promise.all(
          work.batch.slice(offset, offset + 5).map(async (ticker) => {
            let timing: MarketTiming | undefined;
            try {
              const market = await getMarket(ticker);
              timing = timingFromMarket(market, new Date().toISOString());
              const settlement = settlementFromMarket(
                market,
                new Date().toISOString(),
              );
              if (settlement) return { ticker, timing, settlement };
              if (market.status === "active" || market.status === "open")
                return {
                  ticker,
                  timing,
                  quote: (await getQuote(ticker, market)).quote,
                };
              return { ticker, timing };
            } catch (error) {
              return {
                ticker,
                timing,
                error:
                  error instanceof Error
                    ? error.message
                    : "Market update failed.",
              };
            }
          }),
        )),
      );
    }
    const result = await updateSnapshot((snapshot) => {
      assertRun(snapshot, activeId);
      if (snapshot.syncRun?.id !== work.id)
        throw new HttpError(
          409,
          "SYNC_RUN_FINISHED",
          "Another request finished this synchronization. Start a new sync if needed.",
        );
      let ledger = snapshot.ledger;
      const marks = { ...snapshot.marks };
      const marketTimings = { ...snapshot.marketTimings };
      const errors = snapshot.lastSyncErrors.filter(
        (e) => !work.batch.includes(e.ticker),
      );
      let settled = 0;
      for (const item of results) {
        if (item.timing)
          marketTimings[item.ticker] = newerTiming(
            marketTimings[item.ticker],
            item.timing,
          );
        if (item.error) {
          errors.push({ ticker: item.ticker, message: item.error });
          continue;
        }
        if (
          item.quote &&
          (!marks[item.ticker] ||
            Date.parse(item.quote.observedAt) >=
              Date.parse(marks[item.ticker].observedAt))
        )
          marks[item.ticker] = item.quote;
        if (item.settlement) {
          try {
            const outcome = settleMarket(ledger, item.settlement);
            ledger = outcome.state;
            if (!outcome.replayed) settled++;
            delete marks[item.ticker];
          } catch (error) {
            errors.push({
              ticker: item.ticker,
              message:
                error instanceof Error
                  ? error.message
                  : "Settlement requires review.",
            });
          }
        }
      }
      const checkedTickers = [
        ...new Set([...(snapshot.syncRun.checkedTickers ?? []), ...work.batch]),
      ];
      // Trades accepted while upstream reads were in flight must join this run.
      const remaining = [
        ...new Set([
          ...snapshot.syncRun.pendingTickers.filter(
            (t) => !work.batch.includes(t),
          ),
          ...ledger.trades
            .filter(
              (t) => t.status === "open" && !checkedTickers.includes(t.ticker),
            )
            .map((t) => t.ticker),
        ]),
      ];
      const nextCursor = remaining.length ? work.id : null;
      const complete = nextCursor === null && errors.length === 0;
      const now = new Date().toISOString();
      return {
        snapshot: {
          ...snapshot,
          ledger,
          marks,
          marketTimings,
          lastSyncErrors: errors,
          lastSyncAt: complete ? now : snapshot.lastSyncAt,
          syncRun: remaining.length
            ? { ...snapshot.syncRun, pendingTickers: remaining, checkedTickers }
            : null,
        },
        result: {
          checked: work.batch.length,
          settled,
          errors,
          nextCursor,
          complete,
          observedAt: now,
        },
      };
    });
    return response(result);
  } catch (error) {
    return failure(error);
  }
}
