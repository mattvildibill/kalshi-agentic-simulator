import { describe, expect, it } from "vitest";
import {
  addResearch,
  createInitialState,
  EngineError,
  estimateFeeCents,
  executeTrade,
  settleMarket,
  summarizePortfolio,
  type LedgerState,
  type MarketQuote,
  type ResearchInput,
  type TradeInput,
} from "./engine";

const now = "2026-10-29T12:00:00.000Z";
const later = "2026-10-30T12:00:00.000Z";
const nextFillTime = "2026-10-29T12:01:01.000Z";
const researchInput: ResearchInput = {
  idempotencyKey: "review-1",
  ticker: "EVENT-MARKET",
  title: "Example market",
  category: "Economics",
  side: "yes",
  probability: 0.65,
  probabilityLow: 0.55,
  probabilityHigh: 0.75,
  thesis: "Primary data supports the outcome.",
  counterThesis: "A revision could change the outcome.",
  sources: [{ url: "https://example.com/release", title: "Primary release" }],
  decision: "trade",
  rationale: "Expected advantage after execution costs.",
  resolutionCriteria: "Official release exceeds the contract threshold.",
  evidenceAsOf: now,
};
const quote: MarketQuote = {
  ticker: "EVENT-MARKET",
  eventTicker: "EVENT",
  title: "Example market",
  status: "open",
  observedAt: now,
  yesAskCents: 40,
  noAskCents: 62,
  yesAskDepth: 10_000,
  noAskDepth: 10_000,
  yesBidCents: 38,
  noBidCents: 60,
};
const tradeInput: TradeInput = {
  idempotencyKey: "buy-1",
  researchId: "research_review-1",
  ticker: "EVENT-MARKET",
  side: "yes",
  quantity: 100,
  maxPrice: 45,
};
function ready(input: Partial<ResearchInput> = {}): LedgerState {
  return addResearch(
    createInitialState(now),
    { ...researchInput, ...input },
    now,
  ).state;
}
function code(action: () => unknown, expected: string) {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(EngineError);
    expect((error as EngineError).code).toBe(expected);
    return;
  }
  throw new Error(`Expected EngineError ${expected}`);
}

describe("paper ledger", () => {
  it("starts with exactly $100,000 and records the initial deposit", () => {
    const state = createInitialState(now);
    expect(state.cashCents).toBe(10_000_000);
    expect(state.transactions[0].amountCents).toBe(state.cashCents);
    expect(summarizePortfolio(state, [], now).equityCents).toBe(10_000_000);
  });

  it("preserves research and distinguishes idempotent retries from conflicting payloads", () => {
    const initial = createInitialState(now);
    const first = addResearch(initial, researchInput, now);
    expect(initial.research).toHaveLength(0);
    expect(addResearch(first.state, { ...researchInput }, later).replayed).toBe(
      true,
    );
    code(
      () =>
        addResearch(first.state, { ...researchInput, probability: 0.7 }, now),
      "IDEMPOTENCY_CONFLICT",
    );
    const payload = structuredClone(researchInput);
    const recorded = addResearch(initial, payload, now);
    payload.sources[0].title = "Changed after recording";
    expect(recorded.research.sources[0].title).toBe("Primary release");
  });

  it("rejects invalid uncertainty intervals, unsafe source URLs, and future evidence", () => {
    code(() => ready({ probabilityLow: 0.8 }), "INVALID_INPUT");
    code(
      () => ready({ sources: [{ url: "javascript:alert(1)", title: "Bad" }] }),
      "INVALID_INPUT",
    );
    code(() => ready({ evidenceAsOf: later }), "FUTURE_TIMESTAMP");
    code(() => ready({ probability: NaN }), "INVALID_INPUT");
  });

  it("records ask plus slippage, rounded modeled fee, cash and the original quote immutably", () => {
    const state = ready();
    const mutableQuote = structuredClone(quote);
    const result = executeTrade(state, tradeInput, mutableQuote, now);
    expect(result.trade.priceCents).toBe(41);
    expect(result.trade.feeCents).toBe(170);
    expect(result.trade.costCents).toBe(4_270);
    expect(result.trade.expectedValueCents).toBe(2_230);
    expect(result.state.cashCents).toBe(9_995_730);
    expect(result.state.transactions.at(-1)?.amountCents).toBe(-4_270);
    expect(state.trades).toHaveLength(0);
    mutableQuote.yesAskCents = 80;
    expect(result.trade.quote.yesAskCents).toBe(40);
    expect(estimateFeeCents(1, 50)).toBe(2);
  });

  it("replays a trade without charging again even when the market has subsequently closed", () => {
    const first = executeTrade(ready(), tradeInput, quote, now);
    const replay = executeTrade(
      first.state,
      tradeInput,
      { ...quote, status: "closed" },
      later,
    );
    expect(replay.replayed).toBe(true);
    expect(replay.state).toBe(first.state);
    expect(replay.state.trades).toHaveLength(1);
    code(
      () =>
        executeTrade(first.state, { ...tradeInput, quantity: 101 }, quote, now),
      "IDEMPOTENCY_CONFLICT",
    );
  });

  it("prevents new keys from reusing market liquidity within 60 seconds on either side", () => {
    const first = executeTrade(
      ready(),
      tradeInput,
      { ...quote, yesAskDepth: 100 },
      now,
    );
    const withinCooldown = "2026-10-29T12:00:59.999Z";
    code(
      () =>
        executeTrade(
          first.state,
          { ...tradeInput, idempotencyKey: "buy-again" },
          { ...quote, observedAt: withinCooldown },
          withinCooldown,
        ),
      "LIQUIDITY_COOLDOWN",
    );
    const withNoResearch = addResearch(
      first.state,
      {
        ...researchInput,
        idempotencyKey: "review-no",
        side: "no",
        probability: 0.8,
        probabilityLow: 0.7,
        probabilityHigh: 0.9,
      },
      now,
    ).state;
    code(
      () =>
        executeTrade(
          withNoResearch,
          {
            ...tradeInput,
            idempotencyKey: "buy-no",
            researchId: "research_review-no",
            side: "no",
            maxPrice: 65,
          },
          { ...quote, observedAt: withinCooldown },
          withinCooldown,
        ),
      "LIQUIDITY_COOLDOWN",
    );
    expect(executeTrade(first.state, tradeInput, quote, now).replayed).toBe(
      true,
    );
    const next = executeTrade(
      first.state,
      { ...tradeInput, idempotencyKey: "buy-after-cooldown" },
      { ...quote, observedAt: nextFillTime },
      nextFillTime,
    );
    expect(next.state.trades).toHaveLength(2);
    expect(next.replayed).toBe(false);
  });

  it("requires matching actionable research and rejects stale research/evidence", () => {
    code(
      () => executeTrade(ready({ decision: "watch" }), tradeInput, quote, now),
      "RESEARCH_REQUIRED",
    );
    code(
      () => executeTrade(ready({ side: "no" }), tradeInput, quote, now),
      "RESEARCH_REQUIRED",
    );
    const tomorrow = "2026-10-30T12:00:01.000Z";
    code(
      () =>
        executeTrade(
          ready(),
          tradeInput,
          { ...quote, observedAt: tomorrow },
          tomorrow,
        ),
      "STALE_DATA",
    );
    const staleEvidence = ready({ evidenceAsOf: "2026-10-28T11:59:00.000Z" });
    code(
      () => executeTrade(staleEvidence, tradeInput, quote, now),
      "STALE_DATA",
    );
  });

  it("rejects stale, future, mismatched, closed, and expired quotes", () => {
    const state = ready();
    code(
      () =>
        executeTrade(
          state,
          tradeInput,
          { ...quote, observedAt: "2026-10-29T11:58:59.000Z" },
          now,
        ),
      "STALE_DATA",
    );
    code(
      () =>
        executeTrade(state, tradeInput, { ...quote, observedAt: later }, now),
      "FUTURE_TIMESTAMP",
    );
    code(
      () =>
        executeTrade(state, tradeInput, { ...quote, ticker: "DIFFERENT" }, now),
      "QUOTE_MISMATCH",
    );
    code(
      () =>
        executeTrade(state, tradeInput, { ...quote, status: "closed" }, now),
      "MARKET_CLOSED",
    );
    code(
      () => executeTrade(state, tradeInput, { ...quote, closesAt: now }, now),
      "MARKET_CLOSED",
    );
  });

  it("rejects excessive prices, unavailable asks, insufficient depth, and nonpositive expected value", () => {
    code(
      () => executeTrade(ready(), { ...tradeInput, maxPrice: 40 }, quote, now),
      "PRICE_LIMIT",
    );
    code(
      () =>
        executeTrade(ready(), tradeInput, { ...quote, yesAskCents: null }, now),
      "NO_EXECUTABLE_QUOTE",
    );
    code(
      () =>
        executeTrade(ready(), tradeInput, { ...quote, yesAskDepth: 99 }, now),
      "INSUFFICIENT_LIQUIDITY",
    );
    code(
      () =>
        executeTrade(
          ready({ probability: 0.4, probabilityLow: 0.3 }),
          tradeInput,
          quote,
          now,
        ),
      "NO_EDGE",
    );
  });

  it("caps cumulative market exposure and independently prevents borrowing", () => {
    const first = executeTrade(
      ready(),
      { ...tradeInput, quantity: 20_000 },
      { ...quote, yesAskDepth: 100_000 },
      now,
    );
    code(
      () =>
        executeTrade(
          first.state,
          { ...tradeInput, idempotencyKey: "buy-2", quantity: 4_000 },
          { ...quote, observedAt: nextFillTime },
          nextFillTime,
        ),
      "POSITION_LIMIT",
    );
    code(
      () => executeTrade({ ...ready(), cashCents: 1 }, tradeInput, quote, now),
      "INSUFFICIENT_CASH",
    );
  });

  it("accepts exactly $10,000 including fees but rejects the next contract", () => {
    const boundaryQuote = { ...quote, yesAskCents: 34, yesAskDepth: 100_000 };
    const input = { ...tradeInput, quantity: 27_328 };
    const result = executeTrade(ready(), input, boundaryQuote, now);
    expect(result.trade.costCents).toBe(1_000_000);
    expect(result.trade.feeCents).toBe(43_520);
    expect(result.state.cashCents).toBe(9_000_000);
    expect(executeTrade(result.state, input, boundaryQuote, now).state).toBe(
      result.state,
    );
    code(
      () =>
        executeTrade(
          ready(),
          { ...input, quantity: 27_329 },
          boundaryQuote,
          now,
        ),
      "POSITION_LIMIT",
    );
  });

  it("counts combined YES and NO fills and their fees toward the same $10,000", () => {
    const boundaryQuote = {
      ...quote,
      yesAskCents: 34,
      noAskCents: 34,
      yesAskDepth: 100_000,
      noAskDepth: 100_000,
    };
    const first = executeTrade(
      ready(),
      { ...tradeInput, quantity: 13_664 },
      boundaryQuote,
      now,
    );
    const state = addResearch(
      first.state,
      { ...researchInput, idempotencyKey: "review-no-boundary", side: "no" },
      now,
    ).state;
    const input = {
      ...tradeInput,
      idempotencyKey: "buy-no-boundary",
      researchId: "research_review-no-boundary",
      side: "no" as const,
      quantity: 13_664,
    };
    const second = executeTrade(
      state,
      input,
      { ...boundaryQuote, observedAt: nextFillTime },
      nextFillTime,
    );
    expect(second.state.trades.reduce((sum, t) => sum + t.costCents, 0)).toBe(
      1_000_000,
    );
    expect(second.state.cashCents).toBe(9_000_000);
    code(
      () =>
        executeTrade(
          state,
          { ...input, quantity: 13_665 },
          { ...boundaryQuote, observedAt: nextFillTime },
          nextFillTime,
        ),
      "POSITION_LIMIT",
    );
  });

  it("caps cumulative event exposure across distinct markets", () => {
    let state = createInitialState(now);
    for (let i = 0; i < 5; i++) {
      const ticker = `EVENT-${i}`;
      state = addResearch(
        state,
        { ...researchInput, ticker, idempotencyKey: `review-${i}` },
        now,
      ).state;
      state = executeTrade(
        state,
        {
          ...tradeInput,
          ticker,
          researchId: `research_review-${i}`,
          idempotencyKey: `buy-${i}`,
          quantity: 4_600,
        },
        { ...quote, ticker },
        now,
      ).state;
    }
    const ticker = "EVENT-final";
    state = addResearch(
      state,
      { ...researchInput, ticker, idempotencyKey: "review-final" },
      now,
    ).state;
    code(
      () =>
        executeTrade(
          state,
          {
            ...tradeInput,
            ticker,
            researchId: "research_review-final",
            idempotencyKey: "buy-final",
            quantity: 1_000,
          },
          { ...quote, ticker },
          now,
        ),
      "EVENT_LIMIT",
    );
  });

  it("settles winning and losing positions exactly once and reconciles ledger cash", () => {
    const bought = executeTrade(ready(), tradeInput, quote, now).state;
    const input = {
      ticker: quote.ticker,
      result: "yes" as const,
      sourceStatus: "finalized" as const,
      observedAt: later,
    };
    const settled = settleMarket(bought, input, later);
    expect(settled.state.cashCents).toBe(10_005_730);
    expect(settled.state.trades[0].profitCents).toBe(5_730);
    expect(bought.trades[0].status).toBe("open");
    expect(settleMarket(settled.state, input, later).state).toBe(settled.state);
    code(
      () => settleMarket(settled.state, { ...input, result: "no" }, later),
      "SETTLEMENT_CONFLICT",
    );
    expect(
      settled.state.transactions.reduce((sum, t) => sum + t.amountCents, 0),
    ).toBe(settled.state.cashCents);
    const loss = settleMarket(bought, { ...input, result: "no" }, later);
    expect(loss.state.trades[0].profitCents).toBe(-4_270);
    expect(loss.state.cashCents).toBe(bought.cashCents);
  });

  it("uses selected-side probabilities for NO trades and supports explicit scalar payout", () => {
    const state = ready({
      side: "no",
      probability: 0.8,
      probabilityLow: 0.7,
      probabilityHigh: 0.9,
    });
    const bought = executeTrade(
      state,
      { ...tradeInput, side: "no", maxPrice: 65 },
      quote,
      now,
    ).state;
    expect(bought.trades[0].expectedValueCents).toBeGreaterThan(0);
    const settled = settleMarket(
      bought,
      {
        ticker: quote.ticker,
        result: "scalar",
        yesPayoutCents: 25,
        sourceStatus: "finalized",
        observedAt: later,
      },
      later,
    ).state;
    expect(settled.trades[0].payoutCents).toBe(7_500);
    code(
      () =>
        settleMarket(
          bought,
          {
            ticker: quote.ticker,
            result: "scalar",
            sourceStatus: "finalized",
            observedAt: later,
          },
          later,
        ),
      "INVALID_INPUT",
    );
    code(
      () =>
        settleMarket(
          bought,
          {
            ticker: quote.ticker,
            result: "yes",
            yesPayoutCents: 25,
            sourceStatus: "finalized",
            observedAt: later,
          },
          later,
        ),
      "UNCONFIRMED_SETTLEMENT",
    );
  });

  it("does not invent mark-to-market values when fresh bids are missing", () => {
    const state = executeTrade(ready(), tradeInput, quote, now).state;
    expect(summarizePortfolio(state, [], now).equityCents).toBeNull();
    expect(
      summarizePortfolio(state, [quote], later).unrealizedProfitCents,
    ).toBeNull();
    const summary = summarizePortfolio(state, [quote], now);
    expect(summary.valuationMethod).toBe("indicative_best_bid");
    expect(summary.executableLiquidationValue).toBe(false);
    expect(summary.estimatedOpenValueCents).toBe(3_800);
    expect(summary.unrealizedProfitCents).toBe(-470);
    expect(summary.equityCents).toBe(9_999_530);
  });
});
