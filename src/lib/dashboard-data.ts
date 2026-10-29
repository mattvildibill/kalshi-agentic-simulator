import { newerTiming } from "./market-timing";
import type { DashboardData } from "./dashboard-types";
import { createInitialState } from "./engine";
import { readSnapshot, storageMode, type Snapshot } from "./storage";
export function projectDashboard(
  snapshot: Snapshot,
  mode: DashboardData["mode"],
): DashboardData {
  const state = snapshot.ledger;
  const open = state.trades.filter((t) => t.status === "open");
  const settled = state.trades.filter((t) => t.status === "settled");
  const activity = [
    ...state.research.map((r) => ({
      id: r.id,
      type: "research",
      description: `${r.decision.toUpperCase()} · ${r.title}`,
      createdAt: r.createdAt,
    })),
    ...state.transactions.map((t) => ({
      id: t.id,
      type: t.kind,
      description:
        t.kind === "deposit"
          ? "Paper portfolio opened with $100,000"
          : `${t.kind === "purchase" ? "Paper position opened" : "Position settled"} · ${t.ticker}`,
      createdAt: t.createdAt,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    mode,
    initialCashCents: state.initialCashCents,
    cashCents: state.cashCents,
    committedCents: open.reduce((sum, t) => sum + t.costCents, 0),
    realizedProfitCents: settled.reduce(
      (sum, t) => sum + (t.profitCents ?? 0),
      0,
    ),
    openPositions: open.length,
    settledPositions: settled.length,
    winRate: settled.length
      ? settled.filter((t) => (t.profitCents ?? 0) > 0).length / settled.length
      : null,
    lastActivityAt: activity[0]?.createdAt ?? null,
    lastSyncAt: snapshot.lastSyncAt,
    research: [...state.research]
      .reverse()
      .map(
        ({ requestFingerprint: _fingerprint, idempotencyKey: _key, ...r }) => r,
      ),
    positions: [...state.trades]
      .reverse()
      .map(
        ({
          requestFingerprint: _fingerprint,
          idempotencyKey: _key,
          quote: _quote,
          ...t
        }) => {
          const mark = snapshot.marks[t.ticker];
          const observedQuote =
            mark &&
            Number.isFinite(Date.parse(mark.observedAt)) &&
            (!Number.isFinite(Date.parse(_quote.observedAt)) ||
              Date.parse(mark.observedAt) > Date.parse(_quote.observedAt))
              ? mark
              : _quote;
          return {
            ...t,
            marketTiming: observedQuote.marketTiming
              ? newerTiming(
                  snapshot.marketTimings?.[t.ticker],
                  observedQuote.marketTiming,
                )
              : snapshot.marketTimings?.[t.ticker],
            closesAt: observedQuote?.closesAt ?? null,
            timingAsOf: observedQuote?.observedAt ?? null,
            settlementResult:
              state.settlements.find((s) => s.ticker === t.ticker)?.result ??
              null,
          };
        },
      ),
    activity: activity.slice(0, 30),
  };
}
export async function getDashboard(): Promise<DashboardData> {
  const mode = storageMode();
  if (mode === "unconfigured")
    return {
      ...projectDashboard(
        {
          ledger: createInitialState(),
          lastSyncAt: null,
          lastSyncErrors: [],
          marks: {},
        },
        mode,
      ),
      activity: [],
      lastActivityAt: null,
    };
  try {
    return projectDashboard(await readSnapshot(), mode);
  } catch {
    return {
      ...projectDashboard(
        {
          ledger: createInitialState(),
          lastSyncAt: null,
          lastSyncErrors: [],
          marks: {},
        },
        "unavailable",
      ),
      activity: [],
      lastActivityAt: null,
    };
  }
}
