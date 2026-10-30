import { useId, useState } from "react";
import type { DashboardData, DashboardResearch } from "@/lib/dashboard-types";
import { realizedHistory } from "@/lib/dashboard-display";
import {
  date,
  EmptyState,
  Icon,
  money,
  percent,
  signedMoney,
} from "./dashboard-ui";

function PerformanceChart({ data }: { data: DashboardData }) {
  const [range, setRange] = useState("All");
  const gradientId = useId();
  const history = realizedHistory(data);
  const dates = [
    data.lastActivityAt,
    data.lastSyncAt,
    ...history.map((p) => p.at),
  ].filter((s): s is string => Boolean(s && Number.isFinite(Date.parse(s))));
  const latest = dates.length ? Math.max(...dates.map(Date.parse)) : null;
  const startDate =
    data.run?.startedAt ??
    data.activity.find((a) => a.type === "deposit")?.createdAt ??
    history[0]?.at;
  const start =
    startDate && Number.isFinite(Date.parse(startDate))
      ? Date.parse(startDate)
      : latest;
  const since =
    range === "All" || latest === null
      ? start
      : Math.max(start ?? latest, latest - (range === "1D" ? 1 : 7) * 86400000);
  const before =
    history.filter((p) => since !== null && Date.parse(p.at) < since).at(-1)
      ?.profitCents ?? 0;
  const visible = history.filter(
    (p) => since === null || Date.parse(p.at) >= since,
  );
  const points =
    since === null
      ? []
      : [
          { at: new Date(since).toISOString(), profitCents: before },
          ...visible,
        ];
  const low = Math.min(0, ...points.map((p) => p.profitCents));
  const high = Math.max(0, ...points.map((p) => p.profitCents));
  const spread = high - low || 100;
  const minY = low - spread * 0.2;
  const maxY = high + spread * 0.2;
  const y = (n: number) => 20 + ((maxY - n) / (maxY - minY)) * 125;
  const x = (at: string) =>
    12 +
    ((Date.parse(at) - (since ?? 0)) /
      Math.max(1, (latest ?? 0) - (since ?? 0))) *
      510;
  const line = points
    .map(
      (p, i) =>
        `${i ? "H" : "M"}${x(p.at)}${i ? `V${y(p.profitCents)}` : ` ${y(p.profitCents)}`}`,
    )
    .join(" ");
  const unavailable =
    data.mode === "unavailable" || data.mode === "unconfigured";
  return (
    <section
      className="panel performance-panel"
      aria-label="Realized portfolio performance"
    >
      <div className="panel-heading">
        <h2>Realized performance</h2>
        <div
          className="segments"
          role="group"
          aria-label="Performance time range"
        >
          {["1D", "1W", "All"].map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="performance-chart">
        <svg
          viewBox="0 0 600 170"
          role="img"
          aria-label={
            unavailable
              ? "Performance unavailable"
              : history.length
                ? `Realized profit ${signedMoney(data.realizedProfitCents)} across ${history.length} settled fills. Open price changes are excluded.`
                : "No settled fills. Realized profit has not been recorded yet."
          }
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity=".12" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <line
                x1="12"
                x2="530"
                y1={20 + i * 42}
                y2={20 + i * 42}
                stroke="var(--line)"
                strokeDasharray="3 5"
              />
              <text
                x="590"
                y={24 + i * 42}
                textAnchor="end"
                className="chart-label"
              >
                {history.length
                  ? money(maxY - (i / 3) * (maxY - minY), 0)
                  : i === 2
                    ? "$0"
                    : ""}
              </text>
            </g>
          ))}
          {history.length > 0 && !unavailable && points.length > 0 && (
            <>
              <path d={`${line} V155 H12 Z`} fill={`url(#${gradientId})`} />
              <path
                d={line}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              {visible.map((p, i) => (
                <circle
                  key={`${p.at}-${i}`}
                  cx={x(p.at)}
                  cy={y(p.profitCents)}
                  r="3"
                  fill="var(--accent)"
                >
                  <title>{`${date(p.at, true)}: ${signedMoney(p.profitCents)}`}</title>
                </circle>
              ))}
            </>
          )}
        </svg>
        {(unavailable || !history.length) && (
          <div className="chart-empty">
            <Icon name="activity" />
            <strong>
              {unavailable
                ? "Performance data unavailable"
                : "The experiment is underway"}
            </strong>
            <span>
              {unavailable
                ? "Connect the ledger to view recorded results."
                : "Realized results appear after the first settlement."}
            </span>
          </div>
        )}
      </div>
      <div className="chart-baseline">
        <span>
          {since === null
            ? "Awaiting ledger"
            : date(new Date(since).toISOString())}
        </span>
        <span>Settled profit only · after modeled fees</span>
      </div>
      {visible.length > 0 && (
        <table className="sr-only">
          <caption>Realized profit through the latest ledger update</caption>
          <thead>
            <tr>
              <th>Settled at</th>
              <th>Cumulative profit</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p, i) => (
              <tr key={i}>
                <td>{date(p.at, true)}</td>
                <td>{signedMoney(p.profitCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function PortfolioOverview({
  data,
  shortlist,
  onResearch,
  onOpportunities,
}: {
  data: DashboardData;
  shortlist: DashboardResearch[];
  onResearch: (item: DashboardResearch) => void;
  onOpportunities: () => void;
}) {
  return (
    <div className="overview-grid">
      <PerformanceChart data={data} />
      <section
        className="panel shortlist-panel"
        aria-labelledby="shortlist-title"
      >
        <div className="panel-heading">
          <h2 id="shortlist-title">Research shortlist</h2>
          <button
            type="button"
            className="text-button"
            onClick={onOpportunities}
          >
            All <Icon name="arrow" />
          </button>
        </div>
        <div className="shortlist-rows">
          {shortlist.length ? (
            shortlist.slice(0, 3).map((item) => (
              <button
                type="button"
                className="shortlist-row"
                key={item.id}
                onClick={() => onResearch(item)}
                aria-haspopup="dialog"
              >
                <span>{item.title}</span>
                <span className="shortlist-meta">
                  <span>
                    {item.side.toUpperCase()} · Estimate{" "}
                    {percent(item.probability)}
                  </span>
                  <strong>
                    {percent(item.probabilityLow)}–
                    {percent(item.probabilityHigh)}
                  </strong>
                </span>
              </button>
            ))
          ) : (
            <EmptyState title="No shortlisted markets">
              Published trade theses and watch decisions appear here.
            </EmptyState>
          )}
        </div>
        <div className="shortlist-foot">
          Latest decision per market · estimates, not guarantees
        </div>
      </section>
    </div>
  );
}
