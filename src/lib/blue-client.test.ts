import { describe, it, expect, vi } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  connection,
  client,
  verify,
  productionOrigin,
} from "../../scripts/blue-client.mjs";

const config = connection({
  BLUE_BASE_URL: productionOrigin,
  BLUE_API_KEY: "test-only-client-key-never-a-real-credential",
});
const timestamp = "2026-10-29T12:00:00.000Z";
const portfolio = {
  mode: "live",
  cashCents: 10000000,
  openPositions: 0,
  lastSyncAt: timestamp,
};
const complete = {
  checked: 0,
  settled: 0,
  errors: [],
  nextCursor: null,
  complete: true,
  observedAt: timestamp,
};
function replies(
  sync: Array<{
    checked: number;
    settled: number;
    errors: unknown[];
    nextCursor: string | null;
    complete: boolean;
    observedAt: string;
  }> = [complete],
  after = portfolio,
) {
  const responses = [
    Response.json({ status: "ready", database: true, blueConfigured: true }),
    new Response(null, { status: 401 }),
    Response.json(portfolio),
    ...sync.map((value) => Response.json(value)),
    Response.json(after),
  ];
  return vi.fn<typeof fetch>().mockImplementation(async () => {
    const response = responses.shift();
    if (!response) throw new Error("Unexpected request");
    return response;
  });
}

describe("Blue production client", () => {
  it.each([
    undefined,
    "http://localhost:3000",
    "https://example.com",
    `${productionOrigin}/other`,
    `${productionOrigin}?x=1`,
    "https://user@kalshi.mattvildibill.com",
    `${productionOrigin}:444`,
  ])("rejects an absent or unapproved production origin: %s", (origin) => {
    expect(() => connection({ BLUE_BASE_URL: origin })).toThrow();
  });
  it("permits local connections only when explicitly selected", () => {
    expect(
      connection({ BLUE_BASE_URL: "http://localhost:3000" }, true).local,
    ).toBe(true);
    expect(() =>
      connection({ BLUE_BASE_URL: productionOrigin }, true),
    ).toThrow();
  });
  it("never loads a stale .env.local or defaults to localhost", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "blue-cli-"));
    const cli = path.resolve("scripts/blue.mjs");
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      BLUE_BASE_URL: productionOrigin,
    };
    delete env.BLUE_API_KEY;
    try {
      writeFileSync(
        path.join(dir, ".env.local"),
        "BLUE_API_KEY=stale-key-that-must-never-be-used\nBLUE_BASE_URL=http://localhost:3000\n",
      );
      const result = spawnSync(process.execPath, [cli, "status"], {
        cwd: dir,
        env,
        encoding: "utf8",
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("BLUE_API_KEY is missing");
      expect(result.stdout + result.stderr).not.toContain(
        "stale-key-that-must-never-be-used",
      );
      const scripts = JSON.parse(
        execFileSync(
          process.execPath,
          ["-p", "JSON.stringify(require('./package.json').scripts)"],
          { encoding: "utf8" },
        ),
      );
      expect(scripts.blue).toBe("node scripts/blue.mjs");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("fails before network access when the credential is missing", async () => {
    const fetcher = vi.fn();
    await expect(
      verify({ ...config, key: undefined }, fetcher),
    ).rejects.toThrow("BLUE_API_KEY is missing");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("requires successful authenticated reads and a persisted empty-portfolio sync", async () => {
    const fetcher = replies();
    const report = await verify(config, fetcher);
    expect(report.authenticatedPortfolio).toBe(true);
    expect(report.sync).toMatchObject({
      complete: true,
      checked: 0,
      persistedLastSyncAt: timestamp,
    });
    const calls = fetcher.mock.calls;
    expect(new URL(String(calls[2][0])).pathname).toBe("/api/blue/portfolio");
    expect(calls[2][1]).toMatchObject({
      headers: { Authorization: `Bearer ${config.key}` },
      redirect: "error",
      cache: "no-store",
    });
    expect(calls[1][1]?.headers).not.toHaveProperty("Authorization");
    expect(calls[3][1]?.method).toBe("POST");
  });
  it("continues repeating run cursors through all sync pages", async () => {
    const page = {
      ...complete,
      checked: 10,
      complete: false,
      nextCursor: "same-run-id",
    };
    const fetcher = replies([page, page, complete]);
    expect((await verify(config, fetcher)).sync).toMatchObject({
      pages: 3,
      checked: 20,
    });
    expect(
      new URL(String(fetcher.mock.calls[4][0])).searchParams.get("cursor"),
    ).toBe("same-run-id");
    expect(
      new URL(String(fetcher.mock.calls[5][0])).searchParams.get("cursor"),
    ).toBe("same-run-id");
  });
  it.each([
    { ...complete, errors: [{ ticker: "TEST", message: "unavailable" }] },
    { ...complete, complete: false },
    { ...complete, observedAt: "invalid" },
  ])("rejects failed, incomplete, or invalid sync results", async (result) => {
    await expect(verify(config, replies([result]))).rejects.toThrow();
  });
  it("rejects an unpersisted sync or a non-live portfolio", async () => {
    await expect(
      verify(
        config,
        replies([complete], {
          ...portfolio,
          lastSyncAt: "2026-01-01T00:00:00Z",
        }),
      ),
    ).rejects.toThrow("not confirmed");
    await expect(
      verify(config, replies([complete], { ...portfolio, mode: "demo" })),
    ).rejects.toThrow("not confirmed");
  });
  it("rejects unauthorized responses and does not follow redirects", async () => {
    for (const status of [401, 302]) {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status }));
      await expect(
        client(config, fetcher)("/api/blue/portfolio"),
      ).rejects.toThrow(`HTTP ${status}`);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(fetcher.mock.calls[0][1]?.redirect).toBe("error");
    }
  });
  it("never sends authorization to an absolute URL on another origin", async () => {
    const fetcher = vi.fn();
    await expect(
      client(config, fetcher)("https://example.com/collect"),
    ).rejects.toThrow("outside");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("retains actionable rejection reasons while redacting credentials", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(
        {
          error: {
            code: "STALE_QUOTE",
            message: `Fetch a new quote. Echo: ${config.key}`,
          },
          unwanted: "Do not dump the entire response",
        },
        { status: 422 },
      ),
    );
    const result = client(config, fetcher)("/api/trades");
    await expect(result).rejects.toThrow("STALE_QUOTE: Fetch a new quote.");
    await expect(result).rejects.not.toThrow(config.key);
    await expect(result).rejects.not.toThrow("Do not dump");
  });
});

it("pins writes to the explicitly selected run without adding it to reads", async () => {
  const fetcher = vi
    .fn()
    .mockImplementation(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
  const request = client(
    { origin: productionOrigin, key: "test-only-key", runId: "run-selected" },
    fetcher,
  );
  await request("/api/research", { method: "POST" });
  expect(fetcher.mock.calls[0][1].headers["X-Blue-Run-Id"]).toBe(
    "run-selected",
  );
  await request("/api/blue/portfolio");
  expect(fetcher.mock.calls[1][1].headers["X-Blue-Run-Id"]).toBeUndefined();
});
