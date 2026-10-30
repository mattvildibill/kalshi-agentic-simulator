import { GET as publicPortfolio } from "./portfolio/route";
import { refreshHeldMarkets } from "@/lib/automatic-sync";
import { POST as resetPost } from "./runs/reset/route";
import { GET as archiveExport } from "./runs/[id]/route";
import { resetRun, runDigest } from "@/lib/runs";
import { GET as positionTiming } from "./positions/[ticker]/timing/route";
import { timingFromMarket } from "@/lib/market-timing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addResearch,
  createInitialState,
  executeTrade,
  type MarketQuote,
  type ResearchInput,
  type TradeInput,
} from "@/lib/engine";
import { getMarket, getQuote, type Market } from "@/lib/kalshi";
import { readSnapshot, updateSnapshot, type Snapshot } from "@/lib/storage";
import { POST as researchPost } from "./research/route";
import { POST as tradePost } from "./trades/route";
import { POST as syncPost } from "./sync/route";
import { GET as privatePortfolio } from "./blue/portfolio/route";
import { GET as instructions } from "./blue/instructions/route";
import { createHash } from "node:crypto";

vi.mock("@/lib/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage")>()),
  readSnapshot: vi.fn(),
  updateSnapshot: vi.fn(),
}));
vi.mock("@/lib/kalshi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/kalshi")>()),
  getMarket: vi.fn(),
  getQuote: vi.fn(),
}));

const now = "2026-10-28T12:00:00.000Z";
const token = "test-only-blue-credential-long-enough-for-auth";
const research: ResearchInput = {
  idempotencyKey: "research-one",
  ticker: "TEST-MARKET",
  title: "Test outcome",
  category: "Test",
  side: "yes",
  probability: 0.7,
  probabilityLow: 0.6,
  probabilityHigh: 0.8,
  thesis: "Evidence supports this outcome.",
  counterThesis: "There is uncertainty.",
  sources: [{ title: "Source", url: "https://example.com/evidence" }],
  decision: "trade",
  rationale: "Positive modeled edge.",
  resolutionCriteria: "The official result must be yes.",
  evidenceAsOf: now,
};
const quote: MarketQuote = {
  ticker: "TEST-MARKET",
  eventTicker: "TEST-EVENT",
  title: "Test outcome",
  status: "open",
  observedAt: now,
  yesAskCents: 40,
  noAskCents: 62,
  yesAskDepth: 1000,
  noAskDepth: 1000,
  yesBidCents: 38,
  noBidCents: 60,
};
const trade: TradeInput = {
  idempotencyKey: "trade-one",
  researchId: "research_research-one",
  ticker: "TEST-MARKET",
  side: "yes",
  quantity: 10,
  maxPrice: 45,
};
function request(path: string, body?: unknown, authenticated = true) {
  return new Request(`https://simulator.example${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function market(fields: Partial<Market> = {}): Market {
  return {
    ticker: quote.ticker,
    event_ticker: quote.eventTicker,
    title: quote.title,
    market_type: "binary",
    status: "active",
    close_time: "2026-11-01T00:00:00Z",
    notional_value_dollars: "1.0000",
    ...fields,
  };
}
let snapshot: Snapshot;
function openPosition() {
  snapshot.ledger = executeTrade(snapshot.ledger, trade, quote, now).state;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
  vi.stubEnv("BLUE_API_KEY", token);
  vi.clearAllMocks();
  snapshot = {
    ledger: addResearch(createInitialState(now), research, now).state,
    lastSyncAt: null,
    lastSyncErrors: [],
    marks: {},
  };
  vi.mocked(readSnapshot).mockImplementation(async () =>
    structuredClone(snapshot),
  );
  vi.mocked(updateSnapshot).mockImplementation(async (mutate) => {
    const outcome = mutate(structuredClone(snapshot));
    snapshot = outcome.snapshot;
    return outcome.result;
  });
  vi.mocked(getQuote).mockResolvedValue({
    market: market(),
    quote: structuredClone(quote),
  });
  vi.mocked(getMarket).mockResolvedValue(market());
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("authenticated research and trade boundary", () => {
  it("rejects research superseded while the server quote was in flight", async () => {
    vi.mocked(getQuote).mockImplementationOnce(async () => {
      snapshot.ledger = addResearch(
        snapshot.ledger,
        { ...research, idempotencyKey: "new-pass", decision: "pass" },
        now,
      ).state;
      return { market: market(), quote };
    });
    const result = await tradePost(request("/api/trades", trade));
    expect(result.status).toBe(422);
    expect((await result.json()).error.code).toBe("RESEARCH_SUPERSEDED");
    expect(snapshot.ledger.trades).toHaveLength(0);
    expect(snapshot.ledger.cashCents).toBe(10000000);
  });
  it("serves only authenticated, versioned deployed instructions with a reproducible hash", async () => {
    expect(
      (await instructions(request("/api/blue/instructions", undefined, false)))
        .status,
    ).toBe(401);
    const result = await instructions(request("/api/blue/instructions"));
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.version).toBe("2026-10-29.2");
    expect(body.playbook).toContain("RESEARCH_SUPERSEDED");
    expect(body.strategy).toContain("lowCaseEVcents");
    expect(body.sha256).toBe(
      createHash("sha256")
        .update(
          JSON.stringify({ playbook: body.playbook, strategy: body.strategy }),
        )
        .digest("hex"),
    );
    expect(result.headers.get("Cache-Control")).toBe("no-store");
    expect(body.playbook + body.strategy).not.toContain(token);
  });
  it("rejects unauthenticated writes before reading or mutating the ledger", async () => {
    const response = await researchPost(
      request("/api/research", research, false),
    );
    expect(response.status).toBe(401);
    expect(updateSnapshot).not.toHaveBeenCalled();
    expect(readSnapshot).not.toHaveBeenCalled();
  });

  it("rejects caller-supplied execution quotes and settlement fields", async () => {
    const response = await tradePost(
      request("/api/trades", { ...trade, quote, result: "yes" }),
    );
    expect(response.status).toBe(422);
    expect(getQuote).not.toHaveBeenCalled();
    expect(snapshot.ledger.trades).toHaveLength(0);
  });

  it("records the server-observed quote and modeled costs", async () => {
    const response = await tradePost(request("/api/trades", trade));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(getQuote).toHaveBeenCalledWith(trade.ticker);
    expect(body.trade.priceCents).toBe(41);
    expect(body.trade.quote).toEqual(quote);
    expect(snapshot.ledger.cashCents).toBe(10_000_000 - body.trade.costCents);
    expect(snapshot.ledger.trades).toHaveLength(1);
  });

  it("replays a successful trade without refetching unavailable market data or spending twice", async () => {
    openPosition();
    const cash = snapshot.ledger.cashCents;
    vi.mocked(getQuote).mockRejectedValue(new Error("upstream offline"));
    const response = await tradePost(request("/api/trades", trade));
    expect(response.status).toBe(200);
    expect((await response.json()).replayed).toBe(true);
    expect(getQuote).not.toHaveBeenCalled();
    expect(snapshot.ledger.cashCents).toBe(cash);
    expect(snapshot.ledger.trades).toHaveLength(1);
  });

  it("rejects a changed payload reusing an existing trade key", async () => {
    openPosition();
    const response = await tradePost(
      request("/api/trades", { ...trade, quantity: 20 }),
    );
    expect(response.status).toBe(409);
    expect(getQuote).not.toHaveBeenCalled();
    expect(snapshot.ledger.trades).toHaveLength(1);
  });
});

describe("settlement synchronization", () => {
  it("continues with markets added during upstream work before declaring completion", async () => {
    openPosition();
    vi.mocked(getMarket).mockImplementationOnce(async () => {
      const nextResearch = {
        ...research,
        idempotencyKey: "second-market-research",
        ticker: "SECOND-MARKET",
      };
      snapshot.ledger = addResearch(snapshot.ledger, nextResearch, now).state;
      snapshot.ledger = executeTrade(
        snapshot.ledger,
        {
          ...trade,
          idempotencyKey: "second-market-fill",
          ticker: "SECOND-MARKET",
          researchId: "research_second-market-research",
        },
        { ...quote, ticker: "SECOND-MARKET" },
        now,
      ).state;
      return market();
    });
    const first = await (await syncPost(request("/api/sync"))).json();
    expect(first.complete).toBe(false);
    expect(first.nextCursor).toBeTruthy();
    expect(snapshot.syncRun?.pendingTickers).toEqual(["SECOND-MARKET"]);
    expect(snapshot.lastSyncAt).toBeNull();
    vi.mocked(getMarket).mockResolvedValue(market({ ticker: "SECOND-MARKET" }));
    vi.mocked(getQuote).mockResolvedValue({
      market: market({ ticker: "SECOND-MARKET" }),
      quote: { ...quote, ticker: "SECOND-MARKET" },
    });
    const second = await (
      await syncPost(request(`/api/sync?cursor=${first.nextCursor}`))
    ).json();
    expect(second.complete).toBe(true);
    expect(snapshot.lastSyncAt).toBe(now);
  });
  it("ignores a submitted winning result and uses the authoritative losing result", async () => {
    openPosition();
    const cash = snapshot.ledger.cashCents;
    vi.mocked(getMarket).mockResolvedValue(
      market({
        status: "finalized",
        result: "no",
        settlement_value_dollars: "0.0000",
      }),
    );
    const response = await syncPost(
      request("/api/sync", { result: "yes", yesPayoutCents: 100 }),
    );
    expect(response.status).toBe(200);
    expect(snapshot.ledger.trades[0].payoutCents).toBe(0);
    expect(snapshot.ledger.cashCents).toBe(cash);
    expect(snapshot.ledger.trades[0].status).toBe("settled");
    expect(snapshot.lastSyncAt).toBe(now);
  });

  it("credits a finalized explicit scalar payout once", async () => {
    openPosition();
    const cash = snapshot.ledger.cashCents;
    vi.mocked(getMarket).mockResolvedValue(
      market({
        status: "finalized",
        result: "scalar",
        settlement_value_dollars: "0.3500",
      }),
    );
    const response = await syncPost(request("/api/sync"));
    expect(response.status).toBe(200);
    expect(snapshot.ledger.trades[0].payoutCents).toBe(350);
    expect(snapshot.ledger.cashCents).toBe(cash + 350);
    await syncPost(request("/api/sync"));
    expect(snapshot.ledger.cashCents).toBe(cash + 350);
    expect(snapshot.ledger.settlements).toHaveLength(1);
  });

  it("leaves disputed outcomes open instead of fabricating settlement", async () => {
    openPosition();
    const cash = snapshot.ledger.cashCents;
    vi.mocked(getMarket).mockResolvedValue(
      market({ status: "disputed", result: "yes" }),
    );
    await syncPost(request("/api/sync"));
    expect(snapshot.ledger.trades[0].status).toBe("open");
    expect(snapshot.ledger.cashCents).toBe(cash);
    expect(snapshot.ledger.settlements).toHaveLength(0);
  });

  it("rejects invented terminal cursors without advancing the completed-check timestamp", async () => {
    openPosition();
    const response = await syncPost(
      request("/api/sync?cursor=skip-everything"),
    );
    expect(response.status).toBe(409);
    expect(snapshot.lastSyncAt).toBeNull();
    expect(getMarket).not.toHaveBeenCalled();
  });

  it("preserves newer price observations against a slower concurrent synchronization", async () => {
    openPosition();
    const newer = {
      ...quote,
      observedAt: "2026-10-28T12:00:05.000Z",
      yesBidCents: 48,
    };
    snapshot.marks[quote.ticker] = newer;
    await syncPost(request("/api/sync"));
    expect(snapshot.marks[quote.ticker]).toEqual(newer);
  });

  it("reports upstream failure without claiming a completed portfolio check", async () => {
    openPosition();
    vi.mocked(getMarket).mockRejectedValue(
      new Error("Market data unavailable."),
    );
    const response = await syncPost(request("/api/sync"));
    const body = await response.json();
    expect(body.complete).toBe(false);
    expect(body.errors).toEqual([
      { ticker: quote.ticker, message: "Market data unavailable." },
    ]);
    expect(snapshot.lastSyncAt).toBeNull();
    expect(snapshot.ledger.trades[0].status).toBe("open");
  });
});

describe("authenticated portfolio", () => {
  it.each([undefined, "incorrect-credential"])(
    "rejects missing/incorrect credentials before storage: %s",
    async (key) => {
      const response = await privatePortfolio(
        new Request("https://simulator.example/api/blue/portfolio", {
          headers: key ? { Authorization: `Bearer ${key}` } : {},
        }),
      );
      expect(response.status).toBe(401);
      expect(readSnapshot).not.toHaveBeenCalled();
    },
  );
  it("returns a live uncached portfolio with the correct credential", async () => {
    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only-server-key");
    const response = await privatePortfolio(
      new Request("https://simulator.example/api/blue/portfolio", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      mode: "live",
      cashCents: 10000000,
    });
    expect(readSnapshot).toHaveBeenCalledTimes(1);
  });
});

describe("public held-position schedule cache", () => {
  const getTiming = (ticker = quote.ticker) =>
    positionTiming(
      new Request("https://simulator.example/api/positions/timing"),
      { params: Promise.resolve({ ticker }) },
    );
  it("rejects unheld tickers before upstream requests or writes", async () => {
    expect((await getTiming()).status).toBe(404);
    expect(getMarket).not.toHaveBeenCalled();
    expect(updateSnapshot).not.toHaveBeenCalled();
  });
  it("returns fresh cache without writes or upstream reads", async () => {
    openPosition();
    snapshot.marketTimings = {
      [quote.ticker]: timingFromMarket(market(), now),
    };
    expect((await getTiming()).status).toBe(200);
    expect(getMarket).not.toHaveBeenCalled();
    expect(updateSnapshot).not.toHaveBeenCalled();
  });
  it("persists timing without touching ledger, marks or sync state; deduplicates simultaneous reads", async () => {
    openPosition();
    const original = structuredClone(snapshot);
    vi.mocked(getMarket).mockResolvedValue(
      market({
        expected_expiration_time: "2026-10-29T04:00:00Z",
        latest_expiration_time: "2026-11-01T00:00:00Z",
      }),
    );
    const responses = await Promise.all([getTiming(), getTiming()]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect(getMarket).toHaveBeenCalledTimes(1);
    expect(snapshot.ledger).toEqual(original.ledger);
    expect(snapshot.marks).toEqual(original.marks);
    expect(snapshot.lastSyncAt).toEqual(original.lastSyncAt);
    expect(snapshot.marketTimings?.[quote.ticker].expectedResultAt).toBe(
      "2026-10-29T04:00:00.000Z",
    );
  });
  it("preserves a newer concurrent observation and concurrent ledger updates", async () => {
    openPosition();
    const newer = timingFromMarket(
      market({ expected_expiration_time: "2026-10-31T00:00:00Z" }),
      "2026-10-28T12:00:01.000Z",
    );
    vi.mocked(getMarket).mockImplementationOnce(async () => {
      snapshot.marketTimings = { [quote.ticker]: newer };
      snapshot.lastSyncAt = "concurrent-sync";
      return market();
    });
    await getTiming();
    expect(snapshot.marketTimings?.[quote.ticker]).toEqual(newer);
    expect(snapshot.lastSyncAt).toBe("concurrent-sync");
  });
  it("keeps stale evidence on failure and backs off retries", async () => {
    openPosition();
    const stale = timingFromMarket(market(), "2026-10-27T00:00:00Z");
    snapshot.marketTimings = { [quote.ticker]: stale };
    vi.mocked(getMarket).mockRejectedValue(new Error("upstream failure"));
    const result = await (await getTiming()).json();
    expect(result.stale).toBe(true);
    expect(result.timing).toEqual(stale);
    await getTiming();
    expect(getMarket).toHaveBeenCalledTimes(1);
    expect(snapshot.marketTimings?.[quote.ticker]).toEqual(stale);
  });
  it("sync records closed-market timing without settling the position", async () => {
    openPosition();
    vi.mocked(getMarket).mockResolvedValue(
      market({
        status: "closed",
        expected_expiration_time: "2026-10-29T04:00:00Z",
      }),
    );
    const before = structuredClone(snapshot.ledger);
    await syncPost(request("/api/sync"));
    expect(snapshot.ledger).toEqual(before);
    expect(snapshot.marketTimings?.[quote.ticker].expectedResultAt).toBe(
      "2026-10-29T04:00:00.000Z",
    );
  });
});

describe("recoverable portfolio run lifecycle", () => {
  const resetInput = {
    idempotencyKey: "reset-test-one",
    expectedRunId: "initial-run",
    reason: "Fresh paper run; preserve originals",
  };
  const withRun = (req: Request, id: string) => {
    req.headers.set("X-Blue-Run-Id", id);
    return req;
  };
  it("requires authentication before archival or reset", async () => {
    const result = await resetPost(
      request("/api/runs/reset", resetInput, false),
    );
    expect(result.status).toBe(401);
    expect(updateSnapshot).not.toHaveBeenCalled();
  });
  it("archives all original content and starts exactly100k with no history carried over", async () => {
    openPosition();
    snapshot.syncRun = {
      id: "old-sync",
      pendingTickers: [quote.ticker],
      startedAt: now,
    };
    snapshot.marks[quote.ticker] = quote;
    const before = structuredClone(snapshot);
    const result = await resetPost(request("/api/runs/reset", resetInput));
    expect(result.status).toBe(201);
    const receipt = (await result.json()).receipt;
    expect(snapshot.archives?.[0].snapshot).toEqual(before);
    expect(runDigest(snapshot.archives![0].snapshot)).toBe(
      receipt.archiveDigest,
    );
    expect(snapshot.ledger.cashCents).toBe(10000000);
    expect(snapshot.ledger.trades).toEqual([]);
    expect(snapshot.ledger.research).toEqual([]);
    expect(snapshot.ledger.settlements).toEqual([]);
    expect(snapshot.ledger.transactions).toHaveLength(1);
    expect(snapshot.syncRun).toBeUndefined();
    expect(snapshot.marks).toEqual({});
    expect(snapshot.lastSyncAt).toBeNull();
    const replay = await resetPost(request("/api/runs/reset", resetInput));
    expect(replay.status).toBe(200);
    expect((await replay.json()).receipt).toEqual(receipt);
    expect(snapshot.archives).toHaveLength(1);
    expect(
      (
        await resetPost(
          request("/api/runs/reset", { ...resetInput, reason: "different" }),
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await resetPost(
          request("/api/runs/reset", {
            ...resetInput,
            idempotencyKey: "reset-other",
          }),
        )
      ).status,
    ).toBe(409);
  });
  it("rejects missing/old run headers and old research after reset, preserving frozen archive", async () => {
    openPosition();
    await resetPost(request("/api/runs/reset", resetInput));
    const frozen = structuredClone(snapshot.archives);
    expect(
      (await researchPost(request("/api/research", research))).status,
    ).toBe(409);
    expect(
      (await tradePost(withRun(request("/api/trades", trade), "initial-run")))
        .status,
    ).toBe(409);
    expect((await syncPost(request("/api/sync"))).status).toBe(409);
    const id = snapshot.activeRun!.id;
    expect(
      (await tradePost(withRun(request("/api/trades", trade), id))).status,
    ).not.toBe(201);
    expect(
      (await researchPost(withRun(request("/api/research", research), id)))
        .status,
    ).toBe(201);
    expect(snapshot.archives).toEqual(frozen);
    expect(snapshot.ledger.trades).toEqual([]);
  });
  it("cannot apply an in-flight old trade after the reset", async () => {
    vi.mocked(getQuote).mockImplementationOnce(async () => {
      snapshot = resetRun(snapshot, resetInput, "run-new", now).snapshot;
      return { market: market(), quote };
    });
    const result = await tradePost(request("/api/trades", trade));
    expect(result.status).toBe(409);
    expect(snapshot.ledger.cashCents).toBe(10000000);
    expect(snapshot.ledger.trades).toEqual([]);
  });
  it("cannot settle or mark old unsettled positions into the new run", async () => {
    openPosition();
    vi.mocked(getMarket).mockImplementationOnce(async () => {
      snapshot = resetRun(snapshot, resetInput, "run-new", now).snapshot;
      return market({ status: "finalized", result: "yes" });
    });
    const result = await syncPost(request("/api/sync"));
    expect(result.status).toBe(409);
    expect(snapshot.ledger.cashCents).toBe(10000000);
    expect(snapshot.ledger.settlements).toEqual([]);
    expect(snapshot.marks).toEqual({});
    expect(snapshot.archives![0].snapshot.ledger.trades[0].status).toBe("open");
  });
  it("preserves prior archives across another reset and exports originals with auth", async () => {
    openPosition();
    await resetPost(request("/api/runs/reset", resetInput));
    const first = structuredClone(snapshot.archives![0]);
    await resetPost(
      request("/api/runs/reset", {
        ...resetInput,
        idempotencyKey: "reset-second",
        expectedRunId: snapshot.activeRun!.id,
      }),
    );
    expect(snapshot.archives).toHaveLength(2);
    expect(snapshot.archives![0]).toEqual(first);
    expect(
      (
        await archiveExport(
          request("/api/runs/initial-run", undefined, false),
          { params: Promise.resolve({ id: "initial-run" }) },
        )
      ).status,
    ).toBe(401);
    const exported = await archiveExport(request("/api/runs/initial-run"), {
      params: Promise.resolve({ id: "initial-run" }),
    });
    expect(await exported.json()).toEqual(first);
  });
  it("rejects an old sync cursor and timing cache refresh after run change", async () => {
    openPosition();
    snapshot.syncRun = {
      id: "old-sync",
      pendingTickers: [quote.ticker],
      startedAt: now,
    };
    await resetPost(request("/api/runs/reset", resetInput));
    expect(
      (
        await syncPost(
          withRun(request("/api/sync?cursor=old-sync"), snapshot.activeRun!.id),
        )
      ).status,
    ).toBe(409);
    const result = await positionTiming(
      new Request(
        "https://simulator.example/api/positions/timing?runId=initial-run",
      ),
      { params: Promise.resolve({ ticker: quote.ticker }) },
    );
    expect(result.status).toBe(409);
  });
});

describe("automatic held-market refresh", () => {
  beforeEach(() => {
    vi.stubEnv("STORAGE_MODE", "local");
    snapshot.activeRun = { id: "automatic-test-run", startedAt: now };
    openPosition();
  });
  it("refreshes official bids without Blue credentials and never changes research or fills", async () => {
    vi.stubEnv("BLUE_API_KEY", "");
    const originalResearch = structuredClone(snapshot.ledger.research);
    const originalTrades = structuredClone(snapshot.ledger.trades);
    vi.mocked(getQuote).mockResolvedValue({
      market: market(),
      quote: { ...quote, yesBidCents: 99 },
    });
    const result = await publicPortfolio();
    const body = await result.json();
    expect(result.status).toBe(200);
    expect(body.positions[0].markPriceCents).toBe(99);
    expect(body.lastSyncAt).toBe(now);
    expect(snapshot.ledger.research).toEqual(originalResearch);
    expect(snapshot.ledger.trades).toEqual(originalTrades);
    expect(result.headers.get("Cache-Control")).toBe("no-store");
    await publicPortfolio();
    expect(getMarket).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date(Date.parse(now) + 60001));
    await publicPortfolio();
    expect(getMarket).toHaveBeenCalledTimes(2);
  });
  it("keeps a one-minute cadence even when the previous upstream check took time", async () => {
    vi.mocked(getMarket).mockImplementationOnce(async () => {
      vi.setSystemTime(new Date(Date.parse(now) + 2000));
      return market();
    });
    await publicPortfolio();
    expect(snapshot.lastSyncAt).toBe(
      new Date(Date.parse(now) + 2000).toISOString(),
    );
    vi.setSystemTime(new Date(Date.parse(now) + 60001));
    await publicPortfolio();
    expect(getMarket).toHaveBeenCalledTimes(2);
  });
  it("settles finalized wins exactly once across repeat and concurrent visitors", async () => {
    const cashBefore = snapshot.ledger.cashCents;
    vi.mocked(getMarket).mockResolvedValue(
      market({ status: "finalized", result: "yes" }),
    );
    await Promise.all([
      publicPortfolio(),
      publicPortfolio(),
      publicPortfolio(),
    ]);
    await publicPortfolio();
    expect(snapshot.ledger.trades[0].status).toBe("settled");
    expect(snapshot.ledger.cashCents).toBe(cashBefore + trade.quantity * 100);
    expect(snapshot.ledger.settlements).toHaveLength(1);
    expect(getMarket).toHaveBeenCalledTimes(1);
    expect(getQuote).not.toHaveBeenCalled();
  });
  it("keeps unfinalized results open and exposes failures with a shared retry cooldown", async () => {
    vi.mocked(getMarket).mockResolvedValueOnce(
      market({ status: "closed", result: "yes" }),
    );
    await publicPortfolio();
    expect(snapshot.ledger.settlements).toHaveLength(0);
    vi.setSystemTime(new Date(Date.parse(now) + 60001));
    vi.mocked(getMarket).mockRejectedValue(
      new Error("Official market unavailable"),
    );
    const failed = await publicPortfolio();
    expect(failed.status).toBe(200);
    expect((await failed.json()).syncErrors[0].message).toBe(
      "Official market unavailable",
    );
    await publicPortfolio();
    expect(getMarket).toHaveBeenCalledTimes(2);
    expect(snapshot.ledger.trades[0].status).toBe("open");
    expect(snapshot.lastSyncAt).toBe(now);
    vi.setSystemTime(new Date(Date.parse(now) + 120002));
    await publicPortfolio();
    expect(getMarket).toHaveBeenCalledTimes(3);
  });
  it("recovers expired leases but respects an in-flight server's lease", async () => {
    snapshot.automaticSync = {
      id: "another-server",
      startedAt: now,
      leaseUntil: new Date(Date.parse(now) + 90000).toISOString(),
    };
    await publicPortfolio();
    expect(getMarket).not.toHaveBeenCalled();
    vi.setSystemTime(new Date(Date.parse(now) + 90001));
    await publicPortfolio();
    expect(getMarket).toHaveBeenCalledTimes(1);
  });
  it("cannot commit in-flight market results into a replacement portfolio run", async () => {
    vi.mocked(getMarket).mockImplementationOnce(async () => {
      snapshot = resetRun(
        snapshot,
        {
          idempotencyKey: "reset-auto-test",
          expectedRunId: "automatic-test-run",
          reason: "Test reset",
        },
        "replacement-run",
        now,
      ).snapshot;
      return market({ status: "finalized", result: "yes" });
    });
    const result = await publicPortfolio();
    expect(result.status).toBe(200);
    expect((await result.json()).run.id).toBe("replacement-run");
    expect(snapshot.ledger.cashCents).toBe(10000000);
    expect(snapshot.ledger.settlements).toHaveLength(0);
    expect(snapshot.archives![0].snapshot.ledger.trades[0].status).toBe("open");
  });
  it("continues bounded batches across automatic checks", async () => {
    for (let i = 0; i < 12; i++) {
      const ticker = `AUTO-${i}`;
      const brief = {
        ...research,
        ticker,
        idempotencyKey: `auto-research-${i}`,
      };
      snapshot.ledger = addResearch(snapshot.ledger, brief, now).state;
      snapshot.ledger = executeTrade(
        snapshot.ledger,
        {
          ...trade,
          ticker,
          researchId: `research_auto-research-${i}`,
          idempotencyKey: `auto-trade-${i}`,
        },
        { ...quote, ticker, eventTicker: `EVENT-${i}` },
        now,
      ).state;
    }
    vi.mocked(getMarket).mockImplementation(async (ticker) =>
      market({ ticker }),
    );
    vi.mocked(getQuote).mockImplementation(async (ticker) => ({
      market: market({ ticker }),
      quote: { ...quote, ticker },
    }));
    await refreshHeldMarkets(structuredClone(snapshot));
    expect(getMarket).toHaveBeenCalledTimes(10);
    expect(snapshot.syncRun?.pendingTickers).toHaveLength(3);
    vi.setSystemTime(new Date(Date.parse(now) + 60001));
    await publicPortfolio();
    expect(getMarket).toHaveBeenCalledTimes(13);
    expect(snapshot.syncRun).toBeNull();
    expect(snapshot.lastSyncAt).toBe(new Date().toISOString());
  });
});
