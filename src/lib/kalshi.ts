import { z } from "zod";
import type { MarketQuote, SettlementInput } from "./engine";

// Public market-data API only. This app has no Kalshi credentials or order-placement code.
export const KALSHI_BASE_URL = "https://external-api.kalshi.com/trade-api/v2";
export class MarketDataError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
const marketSchema = z
  .object({
    ticker: z.string(),
    event_ticker: z.string(),
    title: z.string().optional(),
    market_type: z.string(),
    status: z.string(),
    close_time: z.string(),
    rules_primary: z.string().optional(),
    rules_secondary: z.string().optional(),
    result: z.string().optional(),
    settlement_value_dollars: z.string().optional(),
    settlement_value: z.number().optional(),
    settlement_ts: z.string().optional(),
    settlement_bounds_type: z.string().optional(),
    notional_value_dollars: z.string().optional(),
    notional_value: z.number().optional(),
    yes_ask_dollars: z.string().optional(),
    no_ask_dollars: z.string().optional(),
    yes_bid_dollars: z.string().optional(),
    no_bid_dollars: z.string().optional(),
    volume_24h_fp: z.string().optional(),
    volume_24h: z.number().optional(),
  })
  .passthrough();
export type Market = z.infer<typeof marketSchema>;
export function validTicker(ticker: string) {
  if (!/^[A-Za-z0-9_.-]{1,200}$/.test(ticker))
    throw new MarketDataError(
      "INVALID_TICKER",
      "Use a valid Kalshi market ticker.",
    );
  return ticker;
}
async function getJson(path: string) {
  let response: Response;
  try {
    response = await fetch(`${KALSHI_BASE_URL}${path}`, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new MarketDataError(
      "MARKET_DATA_UNAVAILABLE",
      "Kalshi market data could not be reached. No paper trade was placed.",
    );
  }
  if (!response.ok)
    throw new MarketDataError(
      "MARKET_DATA_UNAVAILABLE",
      `Kalshi market data returned HTTP ${response.status}. No paper trade was placed.`,
    );
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new MarketDataError(
      "INVALID_MARKET_DATA",
      "Kalshi returned an unreadable response.",
    );
  }
}
export async function getMarket(ticker: string): Promise<Market> {
  const result = z
    .object({ market: marketSchema })
    .safeParse(
      await getJson(`/markets/${encodeURIComponent(validTicker(ticker))}`),
    );
  if (!result.success || result.data.market.ticker !== ticker)
    throw new MarketDataError(
      "INVALID_MARKET_DATA",
      "Kalshi returned an unexpected market schema or ticker.",
    );
  return result.data.market;
}
export async function listMarkets(cursor?: string, seriesTicker?: string) {
  if (cursor && cursor.length > 2000)
    throw new MarketDataError("INVALID_CURSOR", "Market cursor is too long.");
  const query = new URLSearchParams({
    limit: "100",
    status: "open",
    mve_filter: "exclude",
  });
  if (cursor) query.set("cursor", cursor);
  if (seriesTicker) query.set("series_ticker", validTicker(seriesTicker));
  const result = z
    .object({ markets: z.array(marketSchema), cursor: z.string().optional() })
    .safeParse(await getJson(`/markets?${query}`));
  if (!result.success)
    throw new MarketDataError(
      "INVALID_MARKET_DATA",
      "Kalshi returned an unexpected market list schema.",
    );
  return {
    ...result.data,
    observedAt: new Date().toISOString(),
    nextCursor: result.data.cursor || null,
    source: KALSHI_BASE_URL,
    complete: !result.data.cursor,
  };
}
/** Parse dollar prices exactly to millionths, avoiding float roundoff at cents. */
function microDollars(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+(?:\.\d{1,6})?$/.test(value))
    return null;
  const [whole, decimals = ""] = value.split(".");
  const units = Number(whole) * 1_000_000 + Number(decimals.padEnd(6, "0"));
  return Number.isSafeInteger(units) && units >= 0 && units <= 1_000_000
    ? units
    : null;
}
function bestBid(
  levels: unknown,
  fixed: boolean,
): { microPrice: number; quantity: number } | null {
  if (levels === null || levels === undefined) return null;
  if (!Array.isArray(levels))
    throw new MarketDataError(
      "INVALID_ORDERBOOK",
      "Order book levels are not an array.",
    );
  let best: { microPrice: number; quantity: number } | null = null;
  for (const level of levels) {
    if (!Array.isArray(level) || level.length < 2)
      throw new MarketDataError(
        "INVALID_ORDERBOOK",
        "Malformed order book level.",
      );
    const price = fixed
      ? microDollars(level[0])
      : typeof level[0] === "number" &&
          Number.isInteger(level[0]) &&
          level[0] >= 0 &&
          level[0] <= 100
        ? level[0] * 10_000
        : null;
    const qty =
      fixed &&
      typeof level[1] === "string" &&
      /^\d+(?:\.\d{1,2})?$/.test(level[1])
        ? Number(level[1])
        : !fixed && typeof level[1] === "number"
          ? level[1]
          : NaN;
    if (
      price === null ||
      !Number.isFinite(qty) ||
      qty < 0 ||
      qty > 1_000_000_000
    )
      throw new MarketDataError(
        "INVALID_ORDERBOOK",
        "Unsupported order book price or quantity.",
      );
    if (qty === 0) continue;
    if (!best || price > best.microPrice)
      best = { microPrice: price, quantity: qty };
    else if (price === best.microPrice) best.quantity += qty;
  }
  return best;
}
export function quoteFromData(
  market: Market,
  payload: unknown,
  observedAt: string,
): MarketQuote {
  const notional =
    market.notional_value_dollars !== undefined
      ? microDollars(market.notional_value_dollars)
      : market.notional_value === 100
        ? 1_000_000
        : null;
  if (
    market.market_type !== "binary" ||
    notional !== 1_000_000 ||
    (market.settlement_bounds_type &&
      market.settlement_bounds_type !== "default")
  ) {
    throw new MarketDataError(
      "UNSUPPORTED_MARKET",
      "This version trades standard $1 binary markets only.",
    );
  }
  const data = payload as {
    orderbook_fp?: { yes_dollars?: unknown; no_dollars?: unknown };
    orderbook?: { yes?: unknown; no?: unknown };
  };
  if (!data || (!data.orderbook_fp && !data.orderbook))
    throw new MarketDataError(
      "INVALID_ORDERBOOK",
      "No supported order book was returned.",
    );
  const fixed = Boolean(data.orderbook_fp);
  const yes = bestBid(
    fixed ? data.orderbook_fp?.yes_dollars : data.orderbook?.yes,
    fixed,
  );
  const no = bestBid(
    fixed ? data.orderbook_fp?.no_dollars : data.orderbook?.no,
    fixed,
  );
  return {
    ticker: market.ticker,
    eventTicker: market.event_ticker,
    title: market.title || market.ticker,
    status:
      market.status === "active" || market.status === "open"
        ? "open"
        : market.status === "finalized"
          ? "settled"
          : "closed",
    observedAt,
    closesAt: market.close_time,
    sourceUrl: `${KALSHI_BASE_URL}/markets/${encodeURIComponent(market.ticker)}/orderbook`,
    rulesPrimary: market.rules_primary,
    rulesSecondary: market.rules_secondary,
    yesAskCents: no ? Math.ceil((1_000_000 - no.microPrice) / 10_000) : null,
    noAskCents: yes ? Math.ceil((1_000_000 - yes.microPrice) / 10_000) : null,
    yesAskDepth: no ? Math.floor(no.quantity) : 0,
    noAskDepth: yes ? Math.floor(yes.quantity) : 0,
    yesBidCents: yes ? Math.floor(yes.microPrice / 10_000) : null,
    noBidCents: no ? Math.floor(no.microPrice / 10_000) : null,
  };
}
export async function getQuote(ticker: string) {
  validTicker(ticker);
  const [market, book] = await Promise.all([
    getMarket(ticker),
    getJson(`/markets/${encodeURIComponent(ticker)}/orderbook?depth=1`),
  ]);
  return {
    market,
    quote: quoteFromData(market, book, new Date().toISOString()),
  };
}
export function settlementFromMarket(
  market: Market,
  observedAt: string,
): SettlementInput | null {
  if (market.status !== "finalized") return null;
  if (!["yes", "no", "scalar"].includes(market.result || ""))
    throw new MarketDataError(
      "SETTLEMENT_REVIEW_REQUIRED",
      "Finalized market has an unsupported outcome; manual review required.",
    );
  let cents: number | undefined;
  if (market.settlement_value_dollars !== undefined) {
    const micro = microDollars(market.settlement_value_dollars);
    if (micro === null || micro % 10_000 !== 0)
      throw new MarketDataError(
        "SETTLEMENT_REVIEW_REQUIRED",
        "Settlement payout cannot be represented exactly in cents.",
      );
    cents = micro / 10_000;
  } else if (market.settlement_value !== undefined)
    cents = market.settlement_value;
  if (market.result === "scalar" && cents === undefined)
    throw new MarketDataError(
      "SETTLEMENT_REVIEW_REQUIRED",
      "Scalar settlement requires an explicit payout.",
    );
  return {
    ticker: market.ticker,
    result: market.result as "yes" | "no" | "scalar",
    ...(cents !== undefined ? { yesPayoutCents: cents } : {}),
    sourceStatus: "finalized",
    observedAt,
  };
}
