import { createHash } from "node:crypto";
import { createInitialState } from "./engine";
import { HttpError } from "./http";
import type {
  Snapshot,
  RunIdentity,
  RunSnapshot,
  ResetReceipt,
} from "./storage";
export function activeRun(snapshot: Snapshot): RunIdentity {
  return (
    snapshot.activeRun ?? {
      id: "initial-run",
      startedAt: snapshot.ledger.transactions[0]?.createdAt ?? "",
    }
  );
}
export function requireActiveRun(request: Request, snapshot: Snapshot): string {
  const id = activeRun(snapshot).id;
  const supplied = request.headers.get("x-blue-run-id");
  if ((snapshot.activeRun || supplied) && supplied !== id)
    throw new HttpError(
      409,
      "RUN_MISMATCH",
      "Read the active portfolio and explicitly select its run using X-Blue-Run-Id before writing.",
    );
  return id;
}
export function assertRun(snapshot: Snapshot, id: string) {
  if (activeRun(snapshot).id !== id)
    throw new HttpError(
      409,
      "RUN_CHANGED",
      "The active run changed. This operation was not applied to the new run.",
    );
}
export function runSnapshot(snapshot: Snapshot): RunSnapshot {
  const {
    activeRun: _run,
    archives: _archives,
    resetReceipts: _receipts,
    ...core
  } = snapshot;
  return core;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, v]) => `${JSON.stringify(key)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function runDigest(snapshot: RunSnapshot) {
  return createHash("sha256").update(canonical(snapshot)).digest("hex");
}
export type ResetInput = {
  idempotencyKey: string;
  expectedRunId: string;
  reason: string;
};
export function resetRun(
  snapshot: Snapshot,
  input: ResetInput,
  nextId: string,
  now: string,
) {
  const previous = snapshot.resetReceipts?.find(
    (r) => r.idempotencyKey === input.idempotencyKey,
  );
  if (previous) {
    if (
      previous.expectedRunId !== input.expectedRunId ||
      previous.reason !== input.reason
    )
      throw new HttpError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "This reset key already belongs to a different request.",
      );
    return {
      snapshot,
      result: {
        receipt: previous,
        replayed: true,
        currentRun: activeRun(snapshot),
      },
    };
  }
  const current = activeRun(snapshot);
  if (input.expectedRunId !== current.id)
    throw new HttpError(
      409,
      "RUN_MISMATCH",
      "The requested run is no longer active. Read the portfolio before resetting.",
    );
  if (nextId === current.id || snapshot.archives?.some((a) => a.id === nextId))
    throw new HttpError(
      409,
      "RUN_ID_CONFLICT",
      "Run identifier already exists.",
    );
  const original = runSnapshot(snapshot);
  const digest = runDigest(original);
  const receipt: ResetReceipt = {
    ...input,
    archivedRunId: current.id,
    activeRunId: nextId,
    resetAt: now,
    archiveDigest: digest,
  };
  const next: Snapshot = {
    ledger: createInitialState(now),
    lastSyncAt: null,
    lastSyncErrors: [],
    marks: {},
    activeRun: { id: nextId, startedAt: now },
    archives: [
      ...(snapshot.archives ?? []),
      { ...current, archivedAt: now, snapshot: original, digest },
    ],
    resetReceipts: [...(snapshot.resetReceipts ?? []), receipt],
  };
  return {
    snapshot: next,
    result: { receipt, replayed: false, currentRun: next.activeRun! },
  };
}
