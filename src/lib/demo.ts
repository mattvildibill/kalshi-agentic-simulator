import {
  addResearch,
  createInitialState,
  executeTrade,
  settleMarket,
  type ResearchInput,
  type MarketQuote,
} from "./engine";
import { projectDashboard } from "./dashboard-data";

/** Entirely fictional fixtures, used only by /demo; never written to storage. */
export function demoDashboard() {
  let ledger = createInitialState("2026-10-20T09:00:00Z");
  const makeResearch = (
    id: string,
    title: string,
    category: string,
    decision: ResearchInput["decision"],
    probability: number,
    thesis: string,
    counterThesis: string,
  ): ResearchInput => ({
    idempotencyKey: id,
    ticker: `DEMO-${id.toUpperCase()}`,
    title,
    category,
    side: "yes",
    probability,
    probabilityLow: probability - 0.12,
    probabilityHigh: Math.min(0.98, probability + 0.1),
    decision,
    thesis,
    counterThesis,
    rationale:
      "Illustrative research only. These probabilities and market details are invented to demonstrate the interface.",
    resolutionCriteria:
      "Fictional demonstration contract. No actual Kalshi market, quote, or outcome is represented.",
    evidenceAsOf: "2026-10-21T10:00:00Z",
    sources: [
      {
        title: "Illustrative source: Bureau of Labor Statistics",
        url: "https://www.bls.gov/cpi/",
      },
    ],
  });
  const briefs = [
    makeResearch(
      "inflation",
      "Will the next inflation release come in below expectations?",
      "Economics",
      "trade",
      0.65,
      "Example thesis: softer shelter components and energy prices could pull the headline reading below consensus. A real review would timestamp the forecasts and test the component weights.",
      "Example challenge: volatile energy prices and revisions could offset softer shelter data. Consensus may already price in the same evidence.",
    ),
    makeResearch(
      "rates",
      "Will the central bank hold rates at its next meeting?",
      "Policy",
      "trade",
      0.74,
      "Example thesis: recent statements and a balanced labor report suggest a pause. This fixture shows how research connects to a paper position.",
      "Example challenge: a surprise data release could change the policy path. Correlated macroeconomic exposure needs to be reviewed.",
    ),
    makeResearch(
      "awards",
      "Will a first-time nominee win the leading award?",
      "Culture",
      "watch",
      0.52,
      "Example thesis: early nominations suggest a competitive field. More independent evidence is needed before forming a trade recommendation.",
      "Example challenge: early attention is a weak proxy for final voting. A high potential payout does not establish value.",
    ),
    makeResearch(
      "weather",
      "Will the monthly temperature record be broken?",
      "Climate",
      "pass",
      0.35,
      "Example thesis: the base rate and forecast ensemble provide a starting point for analysis.",
      "Example challenge: differences between the specified reporting station and regional forecasts make the evidence too uncertain.",
    ),
  ];
  for (const brief of briefs)
    ledger = addResearch(ledger, brief, "2026-10-21T10:05:00Z").state;
  for (const id of ["inflation", "rates"]) {
    const research = ledger.research.find((r) => r.idempotencyKey === id)!;
    const quote: MarketQuote = {
      ticker: research.ticker,
      eventTicker: `DEMO-EVENT-${id}`,
      title: research.title,
      status: "open",
      observedAt: "2026-10-21T10:06:00Z",
      yesAskCents: id === "inflation" ? 42 : 60,
      noAskCents: id === "inflation" ? 60 : 42,
      yesAskDepth: 1500,
      noAskDepth: 1500,
      yesBidCents: 40,
      noBidCents: 38,
    };
    ledger = executeTrade(
      ledger,
      {
        idempotencyKey: `demo-${id}`,
        researchId: research.id,
        ticker: research.ticker,
        side: "yes",
        quantity: 1000,
        maxPrice: 70,
      },
      quote,
      "2026-10-21T10:06:00Z",
    ).state;
  }
  ledger = settleMarket(
    ledger,
    {
      ticker: "DEMO-RATES",
      result: "yes",
      sourceStatus: "finalized",
      observedAt: "2026-10-25T16:00:00Z",
    },
    "2026-10-25T16:00:00Z",
  ).state;
  return projectDashboard(
    {
      ledger,
      lastSyncAt: "2026-10-25T16:00:00Z",
      lastSyncErrors: [],
      marks: {},
    },
    "demo",
  );
}
