import type { MarketTiming } from "./market-timing";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  createInitialState,
  type LedgerState,
  type MarketQuote,
} from "./engine";

export interface Snapshot {
  ledger: LedgerState;
  lastSyncAt: string | null;
  lastSyncErrors: { ticker: string; message: string }[];
  marks: Record<string, MarketQuote>;
  marketTimings?: Record<string, MarketTiming>;
  marketTimingRetryAfter?: Record<string, string>;
  syncRun?: { id: string; pendingTickers: string[]; startedAt: string } | null;
}
export class StorageError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function storageMode(): "live" | "local" | "unconfigured" {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
    return "live";
  if (
    process.env.STORAGE_MODE === "local" &&
    process.env.NODE_ENV !== "production" &&
    !process.env.VERCEL
  )
    return "local";
  return "unconfigured";
}
export function initialSnapshot(): Snapshot {
  return {
    ledger: createInitialState(),
    lastSyncAt: null,
    lastSyncErrors: [],
    marks: {},
  };
}
function config() {
  const raw = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!raw || !key)
    throw new StorageError(
      "STORAGE_NOT_CONFIGURED",
      "Persistent storage is not configured.",
    );
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) ||
    url.username ||
    url.password ||
    url.port ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    throw new StorageError(
      "INVALID_STORAGE_CONFIG",
      "Use the dedicated Supabase project HTTPS URL.",
    );
  }
  return { url: `${url.origin}/rest/v1/blue_portfolio`, key };
}
async function rest(query: string, init?: RequestInit) {
  const { url, key } = config();
  let response: Response;
  try {
    response = await fetch(`${url}${query}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      redirect: "error",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...init?.headers,
      },
    });
  } catch {
    throw new StorageError(
      "STORAGE_UNAVAILABLE",
      "Could not reach the portfolio database.",
    );
  }
  if (!response.ok && response.status !== 409)
    throw new StorageError(
      "STORAGE_UNAVAILABLE",
      `Portfolio database returned HTTP ${response.status}. Check project configuration and schema.`,
    );
  return response;
}
type Row = { id: string; revision: number; snapshot: Snapshot };
function checkSnapshot(snapshot: Snapshot): Snapshot {
  if (
    snapshot?.ledger?.version !== 1 ||
    !Array.isArray(snapshot.ledger.trades) ||
    !Array.isArray(snapshot.ledger.research) ||
    !Array.isArray(snapshot.ledger.transactions) ||
    !Array.isArray(snapshot.ledger.settlements) ||
    !Number.isSafeInteger(snapshot.ledger.cashCents)
  ) {
    throw new StorageError(
      "INVALID_STORED_DATA",
      "Stored portfolio is invalid. Restore a verified backup; do not reset it.",
    );
  }
  return snapshot;
}
async function readRow(): Promise<Row> {
  const response = await rest("?id=eq.main&select=id,revision,snapshot");
  const rows = (await response.json()) as Row[];
  if (rows.length === 1) {
    checkSnapshot(rows[0].snapshot);
    return rows[0];
  }
  if (rows.length !== 0)
    throw new StorageError(
      "INVALID_STORED_DATA",
      "Unexpected portfolio response.",
    );
  const created = await rest("", {
    method: "POST",
    body: JSON.stringify({
      id: "main",
      revision: 0,
      snapshot: initialSnapshot(),
    }),
  });
  if (created.status === 409) {
    const retry = await rest("?id=eq.main&select=id,revision,snapshot");
    const existing = (await retry.json()) as Row[];
    if (existing.length !== 1)
      throw new StorageError(
        "STORAGE_UNAVAILABLE",
        "Could not initialize portfolio.",
      );
    checkSnapshot(existing[0].snapshot);
    return existing[0];
  }
  const inserted = (await created.json()) as Row[];
  if (inserted.length !== 1)
    throw new StorageError(
      "STORAGE_UNAVAILABLE",
      "Could not initialize portfolio.",
    );
  return inserted[0];
}
const localPath = () => path.join(process.cwd(), ".local", "portfolio.json");
async function readLocal(): Promise<Snapshot> {
  try {
    return checkSnapshot(JSON.parse(await readFile(localPath(), "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return initialSnapshot();
    throw error;
  }
}
export async function readSnapshot(): Promise<Snapshot> {
  const mode = storageMode();
  if (mode === "unconfigured")
    throw new StorageError(
      "STORAGE_NOT_CONFIGURED",
      "Persistent storage is not configured.",
    );
  return mode === "local" ? readLocal() : (await readRow()).snapshot;
}
let localQueue: Promise<unknown> = Promise.resolve();
/** The mutator must be synchronous and have no side effects: CAS conflicts rerun it. */
export async function updateSnapshot<T>(
  mutate: (snapshot: Snapshot) => { snapshot: Snapshot; result: T },
): Promise<T> {
  const mode = storageMode();
  if (mode === "unconfigured")
    throw new StorageError(
      "STORAGE_NOT_CONFIGURED",
      "Persistent storage is not configured.",
    );
  if (mode === "local") {
    const operation = localQueue.then(async () => {
      const { snapshot, result } = mutate(await readLocal());
      await mkdir(path.dirname(localPath()), { recursive: true });
      const temp = `${localPath()}.${randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify(snapshot), { mode: 0o600 });
      await rename(temp, localPath());
      return result;
    });
    localQueue = operation.catch(() => undefined);
    return operation;
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    const row = await readRow();
    const { snapshot, result } = mutate(row.snapshot);
    const response = await rest(`?id=eq.main&revision=eq.${row.revision}`, {
      method: "PATCH",
      body: JSON.stringify({
        revision: row.revision + 1,
        snapshot,
        updated_at: new Date().toISOString(),
      }),
    });
    if (response.status === 409) continue;
    const updated = (await response.json()) as Row[];
    if (updated.length === 1) return result;
    if (updated.length !== 0)
      throw new StorageError(
        "INVALID_STORED_DATA",
        "Unexpected portfolio update response.",
      );
  }
  throw new StorageError(
    "WRITE_CONFLICT",
    "Concurrent portfolio updates; retry using the same idempotency key.",
  );
}
