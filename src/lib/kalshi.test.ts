import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getMarket,
  getQuote,
  listMarkets,
  quoteFromData,
  settlementFromMarket,
  type Market,
} from "./kalshi";
const now = "2026-10-28T12:00:00Z";
const market: Market = {
  ticker: "KX-EXAMPLE",
  event_ticker: "KX-EVENT",
  title: "Example",
  market_type: "binary",
  notional_value_dollars: "1.0000",
  settlement_bounds_type: "default",
  status: "active",
  close_time: "2026-11-01T00:00:00Z",
};
afterEach(() => vi.unstubAllGlobals());
describe("public Kalshi adapter", () => {
  it("derives asks from opposing bids, uses best prices regardless of order, and conservatively rounds fractions", () => {
    const quote = quoteFromData(
      market,
      {
        orderbook_fp: {
          yes_dollars: [
            ["0.20", "12.00"],
            ["0.4125", "100.50"],
          ],
          no_dollars: [
            ["0.56", "50.75"],
            ["0.50", "300.00"],
          ],
        },
      },
      now,
    );
    expect(quote).toMatchObject({
      yesAskCents: 44,
      noAskCents: 59,
      yesAskDepth: 50,
      noAskDepth: 100,
      yesBidCents: 41,
      noBidCents: 56,
    });
  });
  it("does not invent liquidity from last price or empty sides", () => {
    expect(
      quoteFromData(
        market,
        { orderbook_fp: { yes_dollars: [], no_dollars: [] } },
        now,
      ),
    ).toMatchObject({
      yesAskCents: null,
      noAskCents: null,
      yesAskDepth: 0,
      noAskDepth: 0,
    });
  });
  it("supports legacy integer-cent books without confusing dollars and cents", () => {
    expect(
      quoteFromData(
        market,
        { orderbook: { yes: [[40, 150]], no: [[55, 200]] } },
        now,
      ),
    ).toMatchObject({
      yesAskCents: 45,
      noAskCents: 60,
      yesAskDepth: 200,
      noAskDepth: 150,
    });
  });
  it("rejects malformed data and unsupported contracts rather than simulate a fill", () => {
    expect(() =>
      quoteFromData(
        market,
        { orderbook_fp: { yes_dollars: [["0.42", "oops"]] } },
        now,
      ),
    ).toThrow("quantity");
    expect(() =>
      quoteFromData(
        { ...market, market_type: "scalar" },
        { orderbook: {} },
        now,
      ),
    ).toThrow("standard $1 binary");
    expect(() =>
      quoteFromData(
        { ...market, notional_value_dollars: "5.00" },
        { orderbook: {} },
        now,
      ),
    ).toThrow("standard $1 binary");
  });
  it("settles only finalized explicit supported outcomes, never merely determined", () => {
    expect(
      settlementFromMarket(
        { ...market, status: "determined", result: "yes" },
        now,
      ),
    ).toBeNull();
    expect(
      settlementFromMarket(
        { ...market, status: "finalized", result: "yes" },
        now,
      ),
    ).toMatchObject({ result: "yes", sourceStatus: "finalized" });
    expect(
      settlementFromMarket(
        {
          ...market,
          status: "finalized",
          result: "scalar",
          settlement_value_dollars: "0.4500",
        },
        now,
      ),
    ).toMatchObject({ result: "scalar", yesPayoutCents: 45 });
    expect(() =>
      settlementFromMarket(
        { ...market, status: "finalized", result: "void" },
        now,
      ),
    ).toThrow("manual review");
    expect(() =>
      settlementFromMarket(
        {
          ...market,
          status: "finalized",
          result: "scalar",
          settlement_value_dollars: "0.4550",
        },
        now,
      ),
    ).toThrow("exactly in cents");
  });
  it("preserves pagination and fetches only the fixed public API without credentials", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ markets: [market], cursor: "next+page" }),
      );
    vi.stubGlobal("fetch", fetcher);
    const result = await listMarkets("prior+page");
    expect(result.nextCursor).toBe("next+page");
    expect(result.complete).toBe(false);
    const [url, options] = fetcher.mock.calls[0];
    expect(new URL(url).hostname).toBe("external-api.kalshi.com");
    expect(new URL(url).searchParams.get("cursor")).toBe("prior+page");
    expect(options.headers).not.toHaveProperty("Authorization");
    expect(options.redirect).toBe("error");
  });
  it("rejects ticker injection and upstream identity mismatch", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ market: { ...market, ticker: "DIFFERENT" } }),
      );
    vi.stubGlobal("fetch", fetcher);
    await expect(getMarket("../portfolio")).rejects.toThrow("valid Kalshi");
    expect(fetcher).not.toHaveBeenCalled();
    await expect(getMarket("KX-EXAMPLE")).rejects.toThrow("unexpected market");
  });
  it("fails closed on inaccessible public order books", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(async (url: string) =>
          url.includes("orderbook")
            ? new Response("", { status: 401 })
            : Response.json({ market }),
        ),
    );
    await expect(getQuote("KX-EXAMPLE")).rejects.toThrow("HTTP 401");
  });
});
