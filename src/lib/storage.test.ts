import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  initialSnapshot,
  readSnapshot,
  storageMode,
  updateSnapshot,
  type Snapshot,
} from "./storage";

describe("durable portfolio storage", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://test-project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only-service-role");
    vi.stubEnv("STORAGE_MODE", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reapplies a mutation to the newest portfolio after a concurrent write wins", async () => {
    let revision = 0;
    let snapshot = initialSnapshot();
    snapshot.ledger.cashCents = 1000;
    let raced = false;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method !== "PATCH")
        return Response.json([{ id: "main", revision, snapshot }]);
      const expectedRevision = Number(
        new URL(url).searchParams.get("revision")?.slice(3),
      );
      if (!raced) {
        raced = true;
        revision++;
        snapshot = {
          ...snapshot,
          ledger: { ...snapshot.ledger, cashCents: 800 },
        };
      }
      if (expectedRevision !== revision) return Response.json([]);
      const update = JSON.parse(init.body as string) as {
        revision: number;
        snapshot: Snapshot;
      };
      revision = update.revision;
      snapshot = update.snapshot;
      return Response.json([{ id: "main", revision, snapshot }]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const balancesSeen: number[] = [];
    const balance = await updateSnapshot((current) => {
      balancesSeen.push(current.ledger.cashCents);
      const next = {
        ...current,
        ledger: {
          ...current.ledger,
          cashCents: current.ledger.cashCents - 100,
        },
      };
      return { snapshot: next, result: next.ledger.cashCents };
    });
    expect(balancesSeen).toEqual([1000, 800]);
    expect(balance).toBe(700);
    expect(snapshot.ledger.cashCents).toBe(700);
    expect(revision).toBe(2);
  });

  it("never substitutes a new bankroll for corrupt persisted data", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json([
        { id: "main", revision: 4, snapshot: { ledger: { version: 999 } } },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(readSnapshot()).rejects.toMatchObject({
      code: "INVALID_STORED_DATA",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]).toBeDefined();
  });

  it("refuses local fallback in production or on Vercel", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("STORAGE_MODE", "local");
    vi.stubEnv("NODE_ENV", "production");
    expect(storageMode()).toBe("unconfigured");
    await expect(readSnapshot()).rejects.toMatchObject({
      code: "STORAGE_NOT_CONFIGURED",
    });
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL", "1");
    expect(storageMode()).toBe("unconfigured");
    await expect(
      updateSnapshot((s) => ({ snapshot: s, result: true })),
    ).rejects.toMatchObject({ code: "STORAGE_NOT_CONFIGURED" });
  });

  it("does not fall back to local state when the configured database is unavailable", async () => {
    vi.stubEnv("STORAGE_MODE", "local");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unavailable", { status: 503 })),
    );
    expect(storageMode()).toBe("live");
    await expect(readSnapshot()).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
    });
  });

  it("preserves another initializer’s portfolio when the initial insert races", async () => {
    const existing = initialSnapshot();
    existing.ledger.cashCents = 9_999_123;
    let reads = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "POST") return new Response(null, { status: 409 });
        reads++;
        return Response.json(
          reads === 1 ? [] : [{ id: "main", revision: 1, snapshot: existing }],
        );
      }),
    );
    expect((await readSnapshot()).ledger.cashCents).toBe(9_999_123);
  });

  it("returns an explicit conflict instead of claiming an uncommitted update succeeded", async () => {
    const snapshot = initialSnapshot();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) =>
        Response.json(
          init?.method === "PATCH"
            ? []
            : [{ id: "main", revision: 0, snapshot }],
        ),
      ),
    );
    await expect(
      updateSnapshot((s) => ({ snapshot: s, result: "should-not-return" })),
    ).rejects.toMatchObject({ code: "WRITE_CONFLICT" });
  });
});
