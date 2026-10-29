import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { PositionCard } from "../components/position-card";
import { researchDisplay } from "./research-display";
import type { DashboardPosition } from "./dashboard-types";
const position: DashboardPosition = {
  id: "fill-1",
  researchId: "missing",
  ticker: "TEST",
  title: "Will it happen?",
  side: "no",
  quantity: 100,
  priceCents: 40,
  feeCents: 168,
  costCents: 4168,
  status: "open",
  payoutCents: null,
  profitCents: null,
  createdAt: "2026-10-29T10:00:00Z",
  settledAt: null,
};
const render = (p: DashboardPosition) =>
  renderToStaticMarkup(
    React.createElement(PositionCard, {
      position: p,
      initialCashCents: 10000000,
    }),
  );
describe("position presentation", () => {
  it("includes fees once and separates gross payout from net profit for NO", () => {
    const html = render(position);
    expect(html).toContain("$41.68");
    expect(html).toContain("$100.00");
    expect(html).toContain("$58.32");
    expect(html).not.toContain("$43.36");
    expect(html).toContain("No</strong>");
    expect(html).toContain("Entry research unavailable");
  });
  it("uses recorded scalar payout and profit, not binary win assumptions", () => {
    const html = render({
      ...position,
      status: "settled",
      settlementResult: "scalar",
      payoutCents: 5000,
      profitCents: 832,
      settledAt: "2026-10-30T11:00:00Z",
    });
    expect(html).toContain("Scalar settlement");
    expect(html).toContain("$50.00");
    expect(html).toContain("$8.32");
    expect(html).not.toContain("Payout if full win");
  });
  it("does not turn missing timing or settlement accounting into zero", () => {
    expect(render(position)).toContain("Expected result");
    expect(render(position)).toContain("Not recorded");
    expect(render({ ...position, status: "settled" })).not.toContain("$0.00");
  });
});
describe("readable research", () => {
  it("preserves caveats while moving mixed JSON and formulas intact to details", () => {
    const text =
      'Ratings: {"name":"Player", "elo":2000}. Probability=1/(1+10^(-200/400)). This model is uncalibrated. Review injuries before entry.';
    const parsed = researchDisplay(text);
    expect(parsed.technical).toHaveLength(2);
    expect(parsed.paragraphs.join(" ")).toContain(
      "This model is uncalibrated. Review injuries before entry.",
    );
    expect([...parsed.technical, ...parsed.paragraphs].join(" ")).toBe(text);
  });
  it("does not hide ordinary percentages or dates", () => {
    expect(
      researchDisplay("Estimated chance 65%. Evidence from Oct 29, 2026.")
        .technical,
    ).toEqual([]);
  });
});

it("does not label scalar endpoint settlements as partial returns", () => {
  for (const payoutCents of [0, 10000]) {
    const html = render({
      ...position,
      status: "settled",
      settlementResult: "scalar",
      payoutCents,
      profitCents: payoutCents - position.costCents,
    });
    expect(html).toContain("Scalar settlement");
    expect(html).not.toContain("Partial payout");
  }
});
