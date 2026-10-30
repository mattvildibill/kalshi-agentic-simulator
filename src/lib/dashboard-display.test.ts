import { describe, expect, it } from "vitest";
import { demoDashboard } from "./demo";
import { projectDashboard } from "./dashboard-data";
import {
  portfolioValues,
  positionValue,
  realizedHistory,
} from "./dashboard-display";
import { initialSnapshot } from "./storage";
import type { Trade } from "./engine";

const data = demoDashboard();
const position = data.positions.find((p) => p.status === "open")!;
const marked = {
  ...position,
  markPriceCents: 50,
  markAsOf: "2026-10-29T12:00:00Z",
};

describe("recorded bid valuations", () => {
  it("includes entry fees once in profit and uses the recorded bid for value", () => {
    const result = portfolioValues({
      ...data,
      positions: [
        marked,
        ...data.positions.filter((p) => p.status === "settled"),
      ],
    });
    expect(result.openValue).toBe(50 * marked.quantity);
    expect(result.totalValue).toBe(data.cashCents + 50 * marked.quantity);
    expect(result.openProfit).toBe(50 * marked.quantity - marked.costCents);
    expect(result.totalProfit).toBe(
      result.openProfit! + data.realizedProfitCents,
    );
  });
  it("keeps missing or invalid bids unknown and accepts a recorded zero bid", () => {
    expect(positionValue(position)).toBeNull();
    for (const markPriceCents of [null, -1, 101, 10.5, NaN])
      expect(positionValue({ ...marked, markPriceCents })).toBeNull();
    expect(positionValue({ ...marked, markAsOf: null })).toBeNull();
    expect(positionValue({ ...marked, markAsOf: "invalid" })).toBeNull();
    expect(positionValue({ ...marked, markPriceCents: 0 })).toBe(0);
    expect(portfolioValues(data).totalValue).toBeNull();
    expect(portfolioValues(data).missingMarks).toBe(1);
  });
  it("does not publish a partial portfolio total or a value when storage fails", () => {
    expect(
      portfolioValues({
        ...data,
        positions: [marked, { ...position, id: "missing" }],
      }).totalValue,
    ).toBeNull();
    for (const mode of ["unavailable", "unconfigured"] as const)
      expect(
        portfolioValues({ ...data, mode, positions: [marked] }).totalValue,
      ).toBeNull();
  });
  it("projects the selected side's bid from marks and never substitutes the entry quote", () => {
    const snapshot = initialSnapshot();
    const quote = {
      ticker: position.ticker,
      eventTicker: "EVENT",
      title: position.title,
      status: "open" as const,
      observedAt: "2026-10-29T12:00:00Z",
      yesAskCents: 55,
      noAskCents: 60,
      yesBidCents: 40,
      noBidCents: 45,
      yesAskDepth: 1000,
      noAskDepth: 1000,
    };
    snapshot.ledger.trades = [
      {
        ...position,
        side: "no",
        quote,
        eventTicker: "EVENT",
        idempotencyKey: "test",
        maxPrice: 60,
        expectedValueCents: 0,
        requestFingerprint: "test",
      } satisfies Trade,
    ];
    expect(
      projectDashboard(snapshot, "live").positions[0].markPriceCents,
    ).toBeNull();
    snapshot.marks[position.ticker] = quote;
    expect(projectDashboard(snapshot, "live").positions[0].markPriceCents).toBe(
      45,
    );
    snapshot.marks[position.ticker] = { ...quote, noBidCents: 0 };
    expect(projectDashboard(snapshot, "live").positions[0].markPriceCents).toBe(
      0,
    );
    snapshot.marks[position.ticker] = { ...quote, noBidCents: null };
    expect(
      projectDashboard(snapshot, "live").positions[0].markPriceCents,
    ).toBeNull();
    expect(projectDashboard(snapshot, "live").positions[0]).not.toHaveProperty(
      "quote",
    );
  });
});

it("builds realized history only from settled fills in settlement order", () => {
  const settled = data.positions.find((p) => p.status === "settled")!;
  const history = realizedHistory({
    ...data,
    positions: [
      marked,
      {
        ...settled,
        id: "later",
        profitCents: -100,
        settledAt: "2026-10-29T12:00:00Z",
      },
      { ...settled, profitCents: 300 },
      { ...settled, id: "unknown", profitCents: null },
      { ...settled, id: "invalid", settledAt: "invalid" },
    ],
  });
  expect(history.map((p) => p.profitCents)).toEqual([300, 200]);
});
