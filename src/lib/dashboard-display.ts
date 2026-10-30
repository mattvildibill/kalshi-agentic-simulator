import type { DashboardData, DashboardPosition } from "./dashboard-types";

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
