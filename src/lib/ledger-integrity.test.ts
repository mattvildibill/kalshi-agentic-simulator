import { describe, expect, it } from "vitest";
import {
  addResearch,
  createInitialState,
  executeTrade,
  settleMarket,
  type LedgerState,
} from "./engine";
import { ledgerIsConsistent } from "./ledger-integrity";
const now = "2026-10-29T12:00:00Z";
function ledger(side: "yes" | "no" = "yes") {
  const r = addResearch(
    createInitialState(now),
    {
      idempotencyKey: "review",
      ticker: "TEST",
      title: "Test",
      category: "Test",
      side,
      probability: 0.8,
      probabilityLow: 0.6,
      probabilityHigh: 0.9,
      thesis: "Test",
      counterThesis: "Test",
      sources: [{ url: "https://example.com", title: "Test" }],
      decision: "trade",
      rationale: "Test",
      resolutionCriteria: "Test",
      evidenceAsOf: now,
    },
    now,
  );
  return executeTrade(
    r.state,
    {
      idempotencyKey: "fill",
      researchId: r.research.id,
      ticker: "TEST",
      side,
      quantity: 100,
      maxPrice: 60,
    },
    {
      ticker: "TEST",
      eventTicker: "EVENT",
      title: "Test",
      status: "open",
      observedAt: now,
      yesAskCents: 40,
      noAskCents: 50,
      yesAskDepth: 100,
      noAskDepth: 100,
    },
    now,
  ).state;
}
describe("stored accounting reconciliation", () => {
  it("accepts initial, open and finalized binary/scalar accounting on both sides", () => {
    expect(ledgerIsConsistent(createInitialState(now))).toBe(true);
    for (const side of ["yes", "no"] as const) {
      const state = ledger(side);
      expect(ledgerIsConsistent(state)).toBe(true);
      for (const result of ["yes", "no", "scalar"] as const)
        expect(
          ledgerIsConsistent(
            settleMarket(
              state,
              {
                ticker: "TEST",
                result,
                sourceStatus: "finalized",
                observedAt: now,
                ...(result === "scalar" ? { yesPayoutCents: 35 } : {}),
              },
              now,
            ).state,
          ),
        ).toBe(true);
    }
  });
  const corruptions: [string, (s: LedgerState) => void][] = [
    [
      "cash drift",
      (s) => {
        s.cashCents++;
      },
    ],
    [
      "balance drift",
      (s) => {
        s.transactions[1].balanceCents++;
      },
    ],
    [
      "missing purchase",
      (s) => {
        s.transactions.pop();
      },
    ],
    [
      "duplicated transaction",
      (s) => {
        s.transactions.push(s.transactions[1]);
      },
    ],
    [
      "incorrect fee",
      (s) => {
        s.trades[0].feeCents++;
      },
    ],
    [
      "missing research",
      (s) => {
        s.research = [];
      },
    ],
    [
      "invalid forecast",
      (s) => {
        s.research[0].probability = NaN;
      },
    ],
    [
      "duplicate research",
      (s) => {
        s.research.push(s.research[0]);
      },
    ],
    [
      "unknown transaction",
      (s) => {
        s.transactions[1].tradeId = "missing";
      },
    ],
    [
      "premature payout",
      (s) => {
        s.trades[0].payoutCents = 100;
      },
    ],
    [
      "invalid quantity",
      (s) => {
        s.trades[0].quantity = NaN;
      },
    ],
  ];
  it.each(corruptions)("rejects %s without repairing history", (_, corrupt) => {
    const state = ledger();
    corrupt(state);
    const copy = structuredClone(state);
    expect(ledgerIsConsistent(state)).toBe(false);
    expect(state).toEqual(copy);
  });
  it("rejects contradictory final payouts even when cash balances still add up", () => {
    const state = settleMarket(
      ledger(),
      {
        ticker: "TEST",
        result: "yes",
        sourceStatus: "finalized",
        observedAt: now,
      },
      now,
    ).state;
    state.settlements[0].result = "no";
    expect(ledgerIsConsistent(state)).toBe(false);
  });
});
