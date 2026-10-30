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
          lastSyncAt: "2026-10-29T12:00:00Z",
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
    const observations: (string | null)[] = [];
    const balance = await updateSnapshot((current) => {
      observations.push(current.lastSyncAt);
      const next = {
        ...current,
        lastSyncAt: "2026-10-29T12:01:00Z",
      };
      return { snapshot: next, result: next.lastSyncAt };
    });
    expect(observations).toEqual([null, "2026-10-29T12:00:00Z"]);
    expect(balance).toBe("2026-10-29T12:01:00Z");
    expect(snapshot.ledger.cashCents).toBe(10000000);
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
    existing.lastSyncAt = "2026-10-29T12:00:00Z";
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
    expect((await readSnapshot()).lastSyncAt).toBe("2026-10-29T12:00:00Z");
  });

  it("refuses inconsistent accounting both on read and before a write", async () => {
    const snapshot = initialSnapshot();
    const fetcher = vi.fn(async () =>
      Response.json([{ id: "main", revision: 0, snapshot }]),
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(
      updateSnapshot((current) => ({
        snapshot: { ...current, ledger: { ...current.ledger, cashCents: 1 } },
        result: true,
      })),
    ).rejects.toMatchObject({ code: "INVALID_STORED_DATA" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    snapshot.ledger.cashCents = 1;
    await expect(readSnapshot()).rejects.toMatchObject({
      code: "INVALID_STORED_DATA",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
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
