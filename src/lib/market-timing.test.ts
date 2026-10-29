import { expect, it } from "vitest";
import {
  timingFromMarket,
  officialTimestamp,
  newerTiming,
  timingIsFresh,
} from "./market-timing";
import { formatSchedule } from "../components/position-timing";
const now = "2026-10-29T21:00:00.000Z";
const market = {
  ticker: "TEST",
  status: "active",
  close_time: "2026-11-13T01:30:00Z",
  expected_expiration_time: "2026-10-30T04:30:00Z",
  latest_expiration_time: "2026-11-13T01:30:00Z",
  expiration_time: "2026-11-14T01:30:00Z",
};
it("preserves expected result before trading close and prefers latest expiration", () => {
  const timing = timingFromMarket(market, now);
  expect(timing.expectedResultAt).toBe("2026-10-30T04:30:00.000Z");
  expect(timing.latestExpirationAt).toBe("2026-11-13T01:30:00.000Z");
  expect(timing.latestExpirationSource).toBe("latest_expiration_time");
});
it("uses legacy expiry only for latest expiration, never expected outcome", () => {
  const timing = timingFromMarket(
    { ticker: "T", status: "closed", expiration_time: market.expiration_time },
    now,
  );
  expect(timing.expectedResultAt).toBeNull();
  expect(timing.closesAt).toBeNull();
  expect(timing.latestExpirationSource).toBe("expiration_time");
});
it("rejects invalid, impossible and timezone-less dates", () => {
  for (const value of [
    null,
    42,
    "",
    "2026-02-30T00:00:00Z",
    "2026-10-29T21:00:00",
    "bad",
  ])
    expect(officialTimestamp(value)).toBeNull();
  expect(officialTimestamp("2026-10-29T14:00:00-07:00")).toBe(now);
});
it("only exposes exchange settlement when finalized, never derives it from a deadline", () => {
  expect(
    timingFromMarket({ ...market, settlement_ts: now }, now).exchangeSettledAt,
  ).toBeNull();
  expect(
    timingFromMarket(
      { ...market, status: "finalized", settlement_ts: now },
      now,
    ).exchangeSettledAt,
  ).toBe(now);
});
it("keeps newer observations and marks stale/future data correctly", () => {
  const timing = timingFromMarket(market, now);
  expect(
    newerTiming(timing, { ...timing, observedAt: "2026-10-28T00:00:00Z" }),
  ).toBe(timing);
  expect(timingIsFresh(timing, Date.parse(now) + 899999)).toBe(true);
  expect(timingIsFresh(timing, Date.parse(now) + 900000)).toBe(false);
  expect(timingIsFresh(timing, Date.parse(now) - 1)).toBe(false);
});
it("formats local dates across midnight and daylight-saving changes without changing the instant", () => {
  expect(
    formatSchedule("2026-10-30T04:30:00Z", "America/Los_Angeles"),
  ).toContain("Oct 29, 2026");
  expect(
    formatSchedule("2026-10-30T04:30:00Z", "America/Los_Angeles"),
  ).toContain("PDT");
  expect(
    formatSchedule("2026-11-13T01:30:00Z", "America/Los_Angeles"),
  ).toContain("PST");
  expect(formatSchedule(null, "UTC")).toBe("Not supplied by Kalshi");
});
