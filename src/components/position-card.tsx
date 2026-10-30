import { PositionTiming } from "./position-timing";
import type {
  DashboardPosition,
  DashboardResearch,
} from "@/lib/dashboard-types";
import { ResearchText } from "./research-text";

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
const percent = (p: number) => `${Math.round(p * 100)}%`;
const date = (value?: string | null) =>
  value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "UTC",
        timeZoneName: "short",
      }).format(new Date(value))
    : "Not recorded";

export function PositionCard({
  position: p,
  research,
  initialCashCents,
  demo = false,
  runId,
}: {
  position: DashboardPosition;
  research?: DashboardResearch;
  initialCashCents: number;
  demo?: boolean;
  runId?: string;
}) {
  const settled = p.status === "settled";
  const fullPayout = p.quantity * 100;
  const outcome =
    p.settlementResult === "scalar"
      ? "Scalar settlement"
      : p.settlementResult
        ? p.settlementResult === p.side
          ? "Won"
          : "Lost"
        : "Settled";
  return (
    <article className="position-card">
      <div className="position-card-heading">
        <span className={`side-badge ${p.side}`}>{p.side}</span>
        <span className="position-status">
          {settled ? outcome : "Awaiting settlement"}
        </span>
      </div>
      <h3>{p.title}</h3>
      <dl className="bet-amounts">
        <div>
          <dt>Stake · fees included</dt>
          <dd>{money(p.costCents)}</dd>
        </div>
        <div>
          <dt>{settled ? "Returned" : "Payout if full win"}</dt>
          <dd>
            {settled
              ? p.payoutCents === null
                ? "Not recorded"
                : money(p.payoutCents)
              : money(fullPayout)}
          </dd>
        </div>
        <div>
          <dt>{settled ? "Net profit / loss" : "Net profit if full win"}</dt>
          <dd className={settled && (p.profitCents ?? 0) < 0 ? "negative" : ""}>
            {settled
              ? p.profitCents === null
                ? "Not recorded"
                : money(p.profitCents)
              : money(fullPayout - p.costCents)}
          </dd>
        </div>
      </dl>
      <PositionTiming position={p} demo={demo} runId={runId} />
      {research && (
        <div className="bet-forecast">
          <span>Entry estimate</span>
          <strong>
            {percent(research.probability)} {p.side.toUpperCase()}
          </strong>
          <span>
            {percent(research.probabilityLow)}–
            {percent(research.probabilityHigh)} range
          </span>
        </div>
      )}
      <details className="position-analysis">
        <summary>Analysis & fill details</summary>
        <p className="bet-note">
          This fill used{" "}
          {initialCashCents > 0
            ? `${((p.costCents / initialCashCents) * 100).toFixed(2)}% of starting capital`
            : "an unrecorded share of starting capital"}
          . {p.quantity.toLocaleString("en-US")} contracts at {p.priceCents}¢,
          including {money(p.feeCents)} in modeled fees.
        </p>
        {research && (
          <>
            <p className="bet-note">
              Entry forecast · evidence as of {date(research.evidenceAsOf)}.
              Range represents uncertainty in the estimate.
            </p>
            <h4>Reasoning</h4>
            <ResearchText text={research.thesis} />
            <h4>Counterarguments & uncertainty</h4>
            <ResearchText text={research.counterThesis} />
            <h4>Sizing & review conditions · recorded rationale</h4>
            <ResearchText text={research.rationale} />
            <h4>Resolution rules</h4>
            <ResearchText text={research.resolutionCriteria} />
            <h4>Sources</h4>
            <ul className="position-sources">
              {research.sources.map((source, i) => (
                <li key={i}>
                  {/^https?:\/\//i.test(source.url) ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {source.title}
                    </a>
                  ) : (
                    <span>{source.title} (link unavailable)</span>
                  )}
                </li>
              ))}
            </ul>
            <details className="technical-details">
              <summary>Original research record</summary>
              <pre>{JSON.stringify(research, null, 2)}</pre>
            </details>
          </>
        )}
        {!research && <p className="bet-note">Entry research unavailable.</p>}
        {!settled && (
          <p className="bet-note">
            Full loss: {money(p.costCents)}. Partial payouts follow market
            rules; potential payout is not a cash-out value.
          </p>
        )}
        <details className="technical-details">
          <summary>Fill details</summary>
          <dl className="bet-timing">
            <div>
              <dt>Entered</dt>
              <dd>{date(p.createdAt)}</dd>
            </div>
            <div>
              <dt>Contracts</dt>
              <dd>{p.quantity.toLocaleString("en-US")}</dd>
            </div>
            <div>
              <dt>Price per contract</dt>
              <dd>{p.priceCents}¢</dd>
            </div>
            <div>
              <dt>Modeled fees · already in stake</dt>
              <dd>{money(p.feeCents)}</dd>
            </div>
            <div>
              <dt>Schedule observed</dt>
              <dd>{date(p.timingAsOf)}</dd>
            </div>
            <div>
              <dt>Market</dt>
              <dd>{p.ticker}</dd>
            </div>
            <div>
              <dt>Fill ID</dt>
              <dd>{p.id}</dd>
            </div>
          </dl>
        </details>
      </details>
    </article>
  );
}
