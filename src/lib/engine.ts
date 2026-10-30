import type { MarketTiming } from "./market-timing";
/** Paper-only accounting. All money is integer cents; probabilities describe the selected side. */
export type Side = "yes" | "no";
export type Decision = "trade" | "watch" | "pass";
export const INITIAL_CASH_CENTS = 10_000_000;
export const MAX_QUOTE_AGE_MS = 60_000;
export const MIN_MARKET_FILL_INTERVAL_MS = 60_000;
export const MAX_RESEARCH_AGE_MS = 24 * 60 * 60 * 1000;
export const RISK_POLICY = {
  positionFraction: 0.1,
  eventFraction: 0.1,
  slippageCents: 1,
} as const;

export interface Source {
  url: string;
  title: string;
}
export interface ResearchInput {
  idempotencyKey: string;
  ticker: string;
  title: string;
  category: string;
  side: Side;
  probability: number;
  probabilityLow: number;
  probabilityHigh: number;
  thesis: string;
  counterThesis: string;
  sources: Source[];
  decision: Decision;
  rationale: string;
  resolutionCriteria: string;
  evidenceAsOf: string;
}
export interface Research extends ResearchInput {
  id: string;
  createdAt: string;
  requestFingerprint: string;
}
export interface MarketQuote {
  ticker: string;
  eventTicker: string;
  title: string;
  status: "open" | "closed" | "settled";
  observedAt: string;
  closesAt?: string;
  marketTiming?: MarketTiming;
  sourceUrl?: string;
  rulesPrimary?: string;
  rulesSecondary?: string;
  yesAskCents: number | null;
  noAskCents: number | null;
  yesAskDepth: number;
  noAskDepth: number;
  yesBidCents?: number | null;
  noBidCents?: number | null;
}
export interface TradeInput {
  idempotencyKey: string;
  researchId: string;
  ticker: string;
  side: Side;
  quantity: number;
  /** Maximum simulated execution price per contract, in cents, including slippage. */
  maxPrice: number;
}
export interface Trade extends TradeInput {
  id: string;
  eventTicker: string;
  title: string;
  createdAt: string;
  priceCents: number;
  feeCents: number;
  costCents: number;
  expectedValueCents: number;
  status: "open" | "settled";
  payoutCents: number | null;
  profitCents: number | null;
  settledAt: string | null;
  quote: MarketQuote;
  requestFingerprint: string;
}
export interface SettlementInput {
  ticker: string;
  result: "yes" | "no" | "scalar";
  /** Required for a scalar result; exact payout to one YES contract, in cents. */
  yesPayoutCents?: number;
  sourceStatus: "finalized";
  observedAt: string;
}
export interface Settlement extends SettlementInput {
  id: string;
  createdAt: string;
  totalPayoutCents: number;
}
export interface Transaction {
  id: string;
  kind: "deposit" | "purchase" | "settlement";
  amountCents: number;
  balanceCents: number;
  createdAt: string;
  tradeId?: string;
  ticker?: string;
}
export interface LedgerState {
  version: 1;
  initialCashCents: number;
  cashCents: number;
  research: Research[];
  trades: Trade[];
  settlements: Settlement[];
  transactions: Transaction[];
}
export class EngineError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "EngineError";
  }
}
function fail(code: string, message: string): never {
  throw new EngineError(code, message);
}
function text(
  value: unknown,
  name: string,
  max = 20_000,
): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    fail(
      "INVALID_INPUT",
      `${name} must be nonempty text (maximum ${max} characters).`,
    );
}
function integer(
  value: unknown,
  name: string,
  min: number,
  max: number,
): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    fail("INVALID_INPUT", `${name} must be an integer from ${min} to ${max}.`);
}
function timestamp(value: string, name: string): number {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    fail("INVALID_INPUT", `${name} must be an ISO timestamp with a timezone.`);
  return Date.parse(value);
}
function key(value: string) {
  if (typeof value !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(value))
    fail(
      "INVALID_INPUT",
      "idempotencyKey must contain 1–128 letters, digits, dots, colons, underscores, or hyphens.",
    );
}
function side(value: unknown): asserts value is Side {
  if (value !== "yes" && value !== "no")
    fail("INVALID_INPUT", "side must be yes or no.");
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
function fresh(value: string, name: string, nowMs: number, maxAge: number) {
  const time = timestamp(value, name);
  if (time > nowMs + 5_000)
    fail("FUTURE_TIMESTAMP", `${name} cannot be in the future.`);
  if (nowMs - time > maxAge)
    fail("STALE_DATA", `${name} is too old; refresh before trading.`);
}
function clone<T>(value: T): T {
  return structuredClone(value);
}

export function createInitialState(
  now = new Date().toISOString(),
): LedgerState {
  timestamp(now, "now");
  return {
    version: 1,
    initialCashCents: INITIAL_CASH_CENTS,
    cashCents: INITIAL_CASH_CENTS,
    research: [],
    trades: [],
    settlements: [],
    transactions: [
      {
        id: "initial-deposit",
        kind: "deposit",
        amountCents: INITIAL_CASH_CENTS,
        balanceCents: INITIAL_CASH_CENTS,
        createdAt: now,
      },
    ],
  };
}

export function addResearch(
  state: LedgerState,
  input: ResearchInput,
  now = new Date().toISOString(),
): { state: LedgerState; research: Research; replayed: boolean } {
  key(input.idempotencyKey);
  const fingerprint = canonical(input);
  const existing = state.research.find(
    (r) => r.idempotencyKey === input.idempotencyKey,
  );
  if (existing) {
    if (existing.requestFingerprint !== fingerprint)
      fail(
        "IDEMPOTENCY_CONFLICT",
        "This research idempotency key already has a different payload.",
      );
    return { state, research: existing, replayed: true };
  }
  const nowMs = timestamp(now, "now");
  for (const name of [
    "ticker",
    "title",
    "category",
    "thesis",
    "counterThesis",
    "rationale",
    "resolutionCriteria",
  ] as const)
    text(input[name], name, name === "ticker" ? 200 : 20_000);
  side(input.side);
  if (!["trade", "watch", "pass"].includes(input.decision))
    fail("INVALID_INPUT", "decision must be trade, watch, or pass.");
  for (const name of [
    "probability",
    "probabilityLow",
    "probabilityHigh",
  ] as const) {
    if (!Number.isFinite(input[name]) || input[name] < 0 || input[name] > 1)
      fail("INVALID_INPUT", `${name} must be a probability from 0 to 1.`);
  }
  if (
    input.probabilityLow > input.probability ||
    input.probabilityHigh < input.probability
  )
    fail(
      "INVALID_INPUT",
      "The probability estimate must lie within its uncertainty interval.",
    );
  if (
    !Array.isArray(input.sources) ||
    input.sources.length < 1 ||
    input.sources.length > 30
  )
    fail("INVALID_INPUT", "Research must cite 1–30 sources.");
  for (const source of input.sources) {
    text(source.title, "source title", 500);
    text(source.url, "source URL", 2_000);
    let url: URL;
    try {
      url = new URL(source.url);
    } catch {
      fail("INVALID_INPUT", "Source URLs must be valid HTTPS URLs.");
    }
    if (url.protocol !== "https:" || url.username || url.password)
      fail(
        "INVALID_INPUT",
        "Source URLs must use HTTPS and contain no credentials.",
      );
  }
  const evidenceMs = timestamp(input.evidenceAsOf, "evidenceAsOf");
  if (evidenceMs > nowMs + 5_000)
    fail("FUTURE_TIMESTAMP", "Evidence cannot be dated in the future.");
  const research: Research = {
    ...clone(input),
    id: `research_${input.idempotencyKey}`,
    createdAt: now,
    requestFingerprint: fingerprint,
  };
  return {
    state: { ...state, research: [...state.research, research] },
    research,
    replayed: false,
  };
}

/** Conservative illustrative taker fee; not a promise of Kalshi's actual fee schedule. */
export function estimateFeeCents(quantity: number, priceCents: number): number {
  integer(quantity, "quantity", 1, 100_000);
  integer(priceCents, "priceCents", 1, 100);
  // Algebraically equivalent to ceil(0.07 * q * p * (1-p) * 100), with integer numerator.
  return Math.ceil((7 * quantity * priceCents * (100 - priceCents)) / 10_000);
}

export function executeTrade(
  state: LedgerState,
  input: TradeInput,
  quote: MarketQuote,
  now = new Date().toISOString(),
): { state: LedgerState; trade: Trade; replayed: boolean } {
  key(input.idempotencyKey);
  const fingerprint = canonical(input);
  const existing = state.trades.find(
    (t) => t.idempotencyKey === input.idempotencyKey,
  );
  if (existing) {
    if (existing.requestFingerprint !== fingerprint)
      fail(
        "IDEMPOTENCY_CONFLICT",
        "This trade idempotency key already has a different payload.",
      );
    return { state, trade: existing, replayed: true };
  }
  const nowMs = timestamp(now, "now");
  side(input.side);
  integer(input.quantity, "quantity", 1, 100_000);
  integer(input.maxPrice, "maxPrice", 1, 100);
  text(input.ticker, "ticker", 200);
  text(quote.eventTicker, "eventTicker", 200);
  if (input.ticker !== quote.ticker)
    fail(
      "QUOTE_MISMATCH",
      "The quote does not belong to the requested market.",
    );
  if (
    quote.status !== "open" ||
    state.settlements.some((s) => s.ticker === input.ticker)
  )
    fail("MARKET_CLOSED", "Only open, unsettled markets can be purchased.");
  if (
    state.trades.some(
      (trade) =>
        trade.ticker === input.ticker &&
        nowMs - timestamp(trade.createdAt, "Previous fill") <
          MIN_MARKET_FILL_INTERVAL_MS,
    )
  ) {
    fail(
      "LIQUIDITY_COOLDOWN",
      "Only one new simulated fill per market is allowed every 60 seconds, across both sides. Refresh the quote before trying again.",
    );
  }
  fresh(quote.observedAt, "Quote", nowMs, MAX_QUOTE_AGE_MS);
  if (quote.closesAt && timestamp(quote.closesAt, "closesAt") <= nowMs)
    fail("MARKET_CLOSED", "This market's trading deadline has passed.");
  const research = state.research.find((r) => r.id === input.researchId);
  if (
    !research ||
    research.ticker !== input.ticker ||
    research.side !== input.side ||
    research.decision !== "trade"
  )
    fail(
      "RESEARCH_REQUIRED",
      "A matching trade recommendation for this market and side is required.",
    );
  const latestResearch = state.research.findLast(
    (item) => item.ticker === input.ticker && item.side === input.side,
  );
  if (latestResearch?.id !== research.id)
    fail(
      "RESEARCH_SUPERSEDED",
      "This forecast has been superseded. Use the latest published decision for this market and side.",
    );
  fresh(research.createdAt, "Research", nowMs, MAX_RESEARCH_AGE_MS);
  fresh(research.evidenceAsOf, "Evidence", nowMs, MAX_RESEARCH_AGE_MS);
  const ask = input.side === "yes" ? quote.yesAskCents : quote.noAskCents;
  const depth = input.side === "yes" ? quote.yesAskDepth : quote.noAskDepth;
  if (ask === null || !Number.isSafeInteger(ask) || ask < 1 || ask > 99)
    fail(
      "NO_EXECUTABLE_QUOTE",
      "No supported executable ask is available for this side.",
    );
  if (!Number.isFinite(depth) || depth < input.quantity)
    fail(
      "INSUFFICIENT_LIQUIDITY",
      "The observed ask does not have enough depth for this quantity.",
    );
  const priceCents = ask + RISK_POLICY.slippageCents;
  if (priceCents > input.maxPrice)
    fail(
      "PRICE_LIMIT",
      "The current ask plus conservative slippage exceeds maxPrice.",
    );
  const feeCents = estimateFeeCents(input.quantity, priceCents);
  const costCents = input.quantity * priceCents + feeCents;
  const expectedValueCents = Math.round(
    research.probability * input.quantity * 100 - costCents,
  );
  if (expectedValueCents <= 0)
    fail(
      "NO_EDGE",
      "The selected-side probability does not imply positive expected value after modeled costs.",
    );
  const open = state.trades.filter((t) => t.status === "open");
  const marketExposure = open
    .filter((t) => t.ticker === input.ticker)
    .reduce((sum, t) => sum + t.costCents, 0);
  const eventExposure = open
    .filter((t) => t.eventTicker === quote.eventTicker)
    .reduce((sum, t) => sum + t.costCents, 0);
  if (
    costCents + marketExposure >
    Math.floor(state.initialCashCents * RISK_POLICY.positionFraction)
  )
    fail(
      "POSITION_LIMIT",
      "This purchase would exceed the 10% initial-bankroll limit for one market.",
    );
  if (
    costCents + eventExposure >
    Math.floor(state.initialCashCents * RISK_POLICY.eventFraction)
  )
    fail(
      "EVENT_LIMIT",
      "This purchase would exceed the 10% initial-bankroll limit for one event.",
    );
  if (costCents > state.cashCents)
    fail(
      "INSUFFICIENT_CASH",
      "The portfolio cannot borrow or spend more cash than it holds.",
    );
  const trade: Trade = {
    ...clone(input),
    id: `trade_${input.idempotencyKey}`,
    eventTicker: quote.eventTicker,
    title: quote.title,
    createdAt: now,
    priceCents,
    feeCents,
    costCents,
    expectedValueCents,
    status: "open",
    payoutCents: null,
    profitCents: null,
    settledAt: null,
    quote: clone(quote),
    requestFingerprint: fingerprint,
  };
  const cashCents = state.cashCents - costCents;
  const transaction: Transaction = {
    id: `purchase_${input.idempotencyKey}`,
    kind: "purchase",
    amountCents: -costCents,
    balanceCents: cashCents,
    createdAt: now,
    tradeId: trade.id,
    ticker: trade.ticker,
  };
  return {
    state: {
      ...state,
      cashCents,
      trades: [...state.trades, trade],
      transactions: [...state.transactions, transaction],
    },
    trade,
    replayed: false,
  };
}

/** Input must come from the server's authoritative Kalshi response, never an agent-supplied result. */
export function settleMarket(
  state: LedgerState,
  input: SettlementInput,
  now = new Date().toISOString(),
): { state: LedgerState; settlement: Settlement; replayed: boolean } {
  const nowMs = timestamp(now, "now");
  text(input.ticker, "ticker", 200);
  if (
    input.sourceStatus !== "finalized" ||
    !["yes", "no", "scalar"].includes(input.result)
  )
    fail(
      "UNCONFIRMED_SETTLEMENT",
      "A finalized YES, NO, or explicit scalar payout is required; exceptional outcomes need review.",
    );
  const observedMs = timestamp(input.observedAt, "observedAt");
  if (observedMs > nowMs + 5_000)
    fail("FUTURE_TIMESTAMP", "Settlement observation cannot be in the future.");
  let yesPayout = input.result === "yes" ? 100 : 0;
  if (input.result === "scalar") {
    integer(input.yesPayoutCents, "yesPayoutCents", 0, 100);
    yesPayout = input.yesPayoutCents;
  } else if (
    input.yesPayoutCents !== undefined &&
    input.yesPayoutCents !== yesPayout
  ) {
    fail(
      "UNCONFIRMED_SETTLEMENT",
      "Explicit payout conflicts with the binary result.",
    );
  }
  const existing = state.settlements.find((s) => s.ticker === input.ticker);
  if (existing) {
    const existingPayout =
      existing.result === "yes"
        ? 100
        : existing.result === "no"
          ? 0
          : existing.yesPayoutCents;
    if (existingPayout !== yesPayout || existing.result !== input.result)
      fail(
        "SETTLEMENT_CONFLICT",
        "The market already has a different recorded settlement; manual review is required.",
      );
    return { state, settlement: existing, replayed: true };
  }
  let cashCents = state.cashCents;
  let totalPayoutCents = 0;
  const transactions = [...state.transactions];
  const trades = state.trades.map((trade): Trade => {
    if (trade.ticker !== input.ticker || trade.status !== "open") return trade;
    const payoutCents =
      trade.quantity * (trade.side === "yes" ? yesPayout : 100 - yesPayout);
    cashCents += payoutCents;
    totalPayoutCents += payoutCents;
    transactions.push({
      id: `settlement_${trade.id}`,
      kind: "settlement",
      amountCents: payoutCents,
      balanceCents: cashCents,
      createdAt: now,
      tradeId: trade.id,
      ticker: trade.ticker,
    });
    return {
      ...trade,
      status: "settled",
      payoutCents,
      profitCents: payoutCents - trade.costCents,
      settledAt: now,
    };
  });
  const settlement: Settlement = {
    ...clone(input),
    id: `settlement_${input.ticker}`,
    createdAt: now,
    totalPayoutCents,
  };
  return {
    state: {
      ...state,
      cashCents,
      trades,
      transactions,
      settlements: [...state.settlements, settlement],
    },
    settlement,
    replayed: false,
  };
}

/** Indicative marks use fresh best bids, not asks or entry prices.
 * They do not model sell-side depth, fees, or slippage and are not executable liquidation values.
 * Missing marks stay unknown.
 */
export function summarizePortfolio(
  state: LedgerState,
  quotes: MarketQuote[] = [],
  now = new Date().toISOString(),
) {
  const nowMs = timestamp(now, "now");
  const open = state.trades.filter((t) => t.status === "open");
  const settled = state.trades.filter((t) => t.status === "settled");
  let markedValueCents = 0;
  let unpricedPositions = 0;
  for (const trade of open) {
    const quote = quotes.find((q) => q.ticker === trade.ticker);
    const bid = trade.side === "yes" ? quote?.yesBidCents : quote?.noBidCents;
    const quoteMs = quote ? Date.parse(quote.observedAt) : NaN;
    if (
      !quote ||
      !Number.isSafeInteger(bid) ||
      bid! < 0 ||
      bid! > 100 ||
      !Number.isFinite(quoteMs) ||
      nowMs - quoteMs > MAX_QUOTE_AGE_MS ||
      quoteMs > nowMs + 5_000
    )
      unpricedPositions++;
    else markedValueCents += trade.quantity * bid!;
  }
  const openCostCents = open.reduce((sum, t) => sum + t.costCents, 0);
  const estimatedOpenValueCents = unpricedPositions ? null : markedValueCents;
  return {
    initialCashCents: state.initialCashCents,
    cashCents: state.cashCents,
    openCostCents,
    estimatedOpenValueCents,
    valuationMethod: "indicative_best_bid" as const,
    executableLiquidationValue: false as const,
    equityCents:
      estimatedOpenValueCents === null
        ? null
        : state.cashCents + estimatedOpenValueCents,
    realizedProfitCents: settled.reduce(
      (sum, t) => sum + (t.profitCents ?? 0),
      0,
    ),
    unrealizedProfitCents:
      estimatedOpenValueCents === null
        ? null
        : estimatedOpenValueCents - openCostCents,
    openPositions: open.length,
    settledTrades: settled.length,
    totalTrades: state.trades.length,
    wins: settled.filter((t) => (t.profitCents ?? 0) > 0).length,
    losses: settled.filter((t) => (t.profitCents ?? 0) < 0).length,
    breakeven: settled.filter((t) => t.profitCents === 0).length,
    unpricedPositions,
  };
}
