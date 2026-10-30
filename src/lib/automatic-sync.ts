import { randomUUID } from "node:crypto";
import { activeRun, assertRun } from "./runs";
import { readSnapshot, updateSnapshot, type Snapshot } from "./storage";
import { synchronize } from "./sync";

export const AUTOMATIC_SYNC_INTERVAL_MS = 60_000;
const LEASE_MS = 90_000;
function due(snapshot: Snapshot, now: number) {
  if (
    !snapshot.ledger.trades.some((trade) => trade.status === "open") &&
    !snapshot.syncRun
  )
    return false;
  const automatic = snapshot.automaticSync;
  if (
    automatic &&
    (Date.parse(automatic.leaseUntil) > now ||
      now - Date.parse(automatic.startedAt) < AUTOMATIC_SYNC_INTERVAL_MS)
  )
    return false;
  return (
    Boolean(snapshot.syncRun) ||
    !snapshot.lastSyncAt ||
    now - Date.parse(snapshot.lastSyncAt) >= AUTOMATIC_SYNC_INTERVAL_MS
  );
}

/** All visitors share a persisted lease and cooldown, including failed attempts.
 * Callers cannot select tickers, supply prices/results, or bypass the throttle.
 * One bounded batch per check; later checks continue larger portfolios.
 */
export async function refreshHeldMarkets(
  snapshot: Snapshot,
): Promise<Snapshot> {
  const now = Date.now();
  if (!due(snapshot, now)) return snapshot;
  const runId = activeRun(snapshot).id;
  const id = randomUUID();
  const claimed = await updateSnapshot((current) => {
    assertRun(current, runId);
    if (!due(current, now)) return { snapshot: current, result: false };
    return {
      snapshot: {
        ...current,
        automaticSync: {
          id,
          startedAt: new Date(now).toISOString(),
          leaseUntil: new Date(now + LEASE_MS).toISOString(),
        },
      },
      result: true,
    };
  });
  if (!claimed) return readSnapshot();
  try {
    await synchronize(runId);
  } finally {
    await updateSnapshot((current) => {
      assertRun(current, runId);
      return {
        snapshot:
          current.automaticSync?.id === id
            ? {
                ...current,
                automaticSync: {
                  ...current.automaticSync,
                  leaseUntil: new Date().toISOString(),
                },
              }
            : current,
        result: null,
      };
    });
  }
  return readSnapshot();
}
