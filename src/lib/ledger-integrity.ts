import type { LedgerState } from "./engine";

const money = (value: unknown): value is number => Number.isSafeInteger(value);
/** Reconcile stored accounting before it can be displayed or mutated. Never repair it in place. */
export function ledgerIsConsistent(state: LedgerState): boolean {
  const researchIds = new Set<string>();
  for (const r of state.research) {
    if (
      !r?.id ||
      researchIds.has(r.id) ||
      !["yes", "no"].includes(r.side) ||
      !["trade", "watch", "pass"].includes(r.decision) ||
      ![r.probabilityLow, r.probability, r.probabilityHigh].every(
        (p) => Number.isFinite(p) && p >= 0 && p <= 1,
      ) ||
      r.probabilityLow > r.probability ||
      r.probability > r.probabilityHigh
    )
      return false;
    researchIds.add(r.id);
  }
  if (
    !money(state.initialCashCents) ||
    state.initialCashCents < 0 ||
    !money(state.cashCents) ||
    state.cashCents < 0 ||
    !state.transactions.length
  )
    return false;
  const ids = new Set<string>();
  let balance = 0;
  for (const transaction of state.transactions) {
    if (
      !transaction ||
      !transaction.id ||
      ids.has(transaction.id) ||
      !money(transaction.amountCents) ||
      !money(transaction.balanceCents)
    )
      return false;
    ids.add(transaction.id);
    balance += transaction.amountCents;
    if (!money(balance) || balance < 0 || balance !== transaction.balanceCents)
      return false;
  }
  const deposits = state.transactions.filter((t) => t.kind === "deposit");
  if (
    deposits.length !== 1 ||
    deposits[0] !== state.transactions[0] ||
    deposits[0].amountCents !== state.initialCashCents ||
    balance !== state.cashCents
  )
    return false;
  const trades = new Map(state.trades.map((t) => [t?.id, t]));
  if (trades.size !== state.trades.length) return false;
  for (const trade of state.trades) {
    if (
      !trade?.id ||
      !["yes", "no"].includes(trade.side) ||
      !money(trade.quantity) ||
      trade.quantity < 1 ||
      !money(trade.priceCents) ||
      trade.priceCents < 1 ||
      trade.priceCents > 100 ||
      !money(trade.feeCents) ||
      trade.feeCents < 0 ||
      !money(trade.costCents) ||
      trade.costCents !== trade.quantity * trade.priceCents + trade.feeCents
    )
      return false;
    if (
      !state.research.some(
        (r) =>
          r?.id === trade.researchId &&
          r.ticker === trade.ticker &&
          r.side === trade.side,
      )
    )
      return false;
    const purchases = state.transactions.filter(
      (t) => t.tradeId === trade.id && t.kind === "purchase",
    );
    const payouts = state.transactions.filter(
      (t) => t.tradeId === trade.id && t.kind === "settlement",
    );
    if (
      purchases.length !== 1 ||
      purchases[0].amountCents !== -trade.costCents ||
      purchases[0].ticker !== trade.ticker
    )
      return false;
    if (trade.status === "open") {
      if (
        payouts.length ||
        trade.payoutCents !== null ||
        trade.profitCents !== null ||
        trade.settledAt !== null
      )
        return false;
    } else if (trade.status === "settled") {
      if (
        !money(trade.payoutCents) ||
        trade.payoutCents < 0 ||
        trade.payoutCents > trade.quantity * 100 ||
        trade.profitCents !== trade.payoutCents - trade.costCents ||
        payouts.length !== 1 ||
        payouts[0].amountCents !== trade.payoutCents ||
        payouts[0].ticker !== trade.ticker
      )
        return false;
      const settlement = state.settlements.find(
        (s) => s?.ticker === trade.ticker,
      );
      if (!settlement) return false;
      const yesPayout =
        settlement.result === "yes"
          ? 100
          : settlement.result === "no"
            ? 0
            : settlement.result === "scalar"
              ? settlement.yesPayoutCents
              : undefined;
      if (
        !money(yesPayout) ||
        yesPayout < 0 ||
        yesPayout > 100 ||
        trade.payoutCents !==
          trade.quantity * (trade.side === "yes" ? yesPayout : 100 - yesPayout)
      )
        return false;
    } else return false;
  }
  if (
    state.transactions.some(
      (t) =>
        t.kind !== "deposit" &&
        (!t.tradeId ||
          !trades.has(t.tradeId) ||
          !["purchase", "settlement"].includes(t.kind)),
    )
  )
    return false;
  return state.settlements.every(
    (settlement, index) =>
      settlement &&
      settlement.sourceStatus === "finalized" &&
      state.settlements.findIndex((s) => s?.ticker === settlement.ticker) ===
        index &&
      state.trades
        .filter((t) => t.ticker === settlement.ticker)
        .every((t) => t.status === "settled") &&
      settlement.totalPayoutCents ===
        state.trades
          .filter((t) => t.ticker === settlement.ticker)
          .reduce((sum, t) => sum + (t.payoutCents ?? 0), 0),
  );
}
