import type {
  DashboardData,
  DashboardPosition,
  DashboardResearch,
} from "./dashboard-types";

export function researchShortlist(data: DashboardData): DashboardResearch[] {
  const latest = new Map<string, DashboardResearch>();
  // The projection is newest append first, including equal server timestamps.
  for (const item of data.research) {
    const key = `${item.ticker}:${item.side}`;
    if (!latest.has(key)) latest.set(key, item);
  }
  const settled = new Set(
    data.positions.filter((p) => p.status === "settled").map((p) => p.ticker),
  );
  const observed = Date.parse(
    data.mode === "demo" ? (data.lastSyncAt ?? "") : (data.observedAt ?? ""),
  );
  return [...latest.values()].filter(
    (r) =>
      r.decision !== "pass" &&
      !settled.has(r.ticker) &&
      (data.mode === "demo" ||
        (Number.isFinite(observed) &&
          observed - Date.parse(r.evidenceAsOf) >= -5000 &&
          observed - Date.parse(r.createdAt) >= -5000 &&
          observed - Date.parse(r.evidenceAsOf) <= 86400000 &&
          observed - Date.parse(r.createdAt) <= 86400000)),
  );
}

export function portfolioRisk(data: DashboardData) {
  const open = data.positions.filter((p) => p.status === "open");
  const markets = new Map<string, number>();
  for (const p of open)
    markets.set(p.ticker, (markets.get(p.ticker) ?? 0) + p.costCents);
  return {
    markets: markets.size,
    investedFraction: data.initialCashCents
      ? data.committedCents / data.initialCashCents
      : null,
    largestMarketFraction: data.initialCashCents
      ? Math.max(0, ...markets.values()) / data.initialCashCents
      : null,
  };
}

export function positionValue(position: DashboardPosition): number | null {
  const bid = position.markPriceCents;
  return position.status === "open" &&
    typeof bid === "number" &&
    Number.isInteger(bid) &&
    bid >= 0 &&
    bid <= 100 &&
    Boolean(position.markAsOf && Number.isFinite(Date.parse(position.markAsOf)))
    ? bid * position.quantity
    : null;
}

export function portfolioValues(data: DashboardData) {
  const open = data.positions.filter((p) => p.status === "open");
  const missingMarks = open.filter((p) => positionValue(p) === null).length;
  const known =
    !missingMarks &&
    data.mode !== "unavailable" &&
    data.mode !== "unconfigured";
  const openValue = known
    ? open.reduce((total, p) => total + positionValue(p)!, 0)
    : null;
  const totalValue = openValue === null ? null : data.cashCents + openValue;
  return {
    missingMarks,
    openValue,
    totalValue,
    totalProfit:
      totalValue === null ? null : totalValue - data.initialCashCents,
    openProfit: openValue === null ? null : openValue - data.committedCents,
  };
}

/** Only settled fills contribute. The ledger has no historical mark-to-market series. */
export function realizedHistory(data: DashboardData) {
  let profitCents = 0;
  return data.positions
    .filter(
      (p) =>
        p.status === "settled" &&
        p.profitCents !== null &&
        p.settledAt &&
        Number.isFinite(Date.parse(p.settledAt)),
    )
    .sort((a, b) => a.settledAt!.localeCompare(b.settledAt!))
    .map((p) => ({
      at: p.settledAt!,
      profitCents: (profitCents += p.profitCents!),
    }));
}
