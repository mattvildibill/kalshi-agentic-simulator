/** Public exchange metadata only; none of these timestamps authorize settlement. */
export type MarketTiming = {
  observedAt: string;
  closesAt: string | null;
  expectedResultAt: string | null;
  latestExpirationAt: string | null;
  latestExpirationSource: "latest_expiration_time" | "expiration_time" | null;
  exchangeSettledAt: string | null;
  sourceUrl: string;
};
export const TIMING_CACHE_MS = 15 * 60 * 1000;
export function officialTimestamp(value: unknown): string | null {
  // Require an explicit timezone; do not let server-local parsing invent one.
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  )
    return null;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > new Date(Date.UTC(year, month, 0)).getUTCDate()
  )
    return null;
  return new Date(value).toISOString();
}
export function timingFromMarket(
  market: { ticker: string; status: string; [key: string]: unknown },
  observedAt: string,
): MarketTiming {
  const latest = officialTimestamp(market.latest_expiration_time);
  const legacy = officialTimestamp(market.expiration_time);
  return {
    observedAt,
    closesAt: officialTimestamp(market.close_time),
    expectedResultAt: officialTimestamp(market.expected_expiration_time),
    latestExpirationAt: latest ?? legacy,
    latestExpirationSource: latest
      ? "latest_expiration_time"
      : legacy
        ? "expiration_time"
        : null,
    exchangeSettledAt:
      market.status === "finalized"
        ? officialTimestamp(market.settlement_ts)
        : null,
    sourceUrl: `https://external-api.kalshi.com/trade-api/v2/markets/${encodeURIComponent(market.ticker)}`,
  };
}
export function timingIsFresh(
  timing: MarketTiming | undefined,
  now = Date.now(),
) {
  if (!timing) return false;
  const age = now - Date.parse(timing.observedAt);
  return age >= 0 && age < TIMING_CACHE_MS;
}
export function newerTiming(
  previous: MarketTiming | undefined,
  next: MarketTiming,
) {
  return previous &&
    Date.parse(previous.observedAt) > Date.parse(next.observedAt)
    ? previous
    : next;
}
