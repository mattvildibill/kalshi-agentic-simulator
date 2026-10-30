"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  DashboardData,
  DashboardPosition,
  DashboardResearch,
} from "@/lib/dashboard-types";
import {
  portfolioValues,
  portfolioRisk,
  researchShortlist,
} from "@/lib/dashboard-display";
import { useDashboardData } from "./use-dashboard-data";
import {
  date,
  DetailDialog,
  EmptyState,
  Icon,
  money,
  percent,
  signedMoney,
} from "./dashboard-ui";
import { PositionCard } from "./position-card";
import { PositionTable } from "./position-table";
import { PortfolioOverview } from "./portfolio-overview";
import { decisionLabel, ResearchCard, ResearchPanel } from "./research-panel";

type View = "overview" | "opportunities" | "research" | "activity";
const viewTitles: Record<View, string> = {
  overview: "Portfolio overview",
  opportunities: "Find the next opportunity",
  research: "Research journal",
  activity: "Every decision, recorded",
};

export default function Dashboard({
  data: initialData,
}: {
  data: DashboardData;
}) {
  const { data, refreshing, refreshError, refreshedAt, refresh } =
    useDashboardData(initialData);
  const [view, setView] = useState<View>("overview");
  const [researchFilter, setResearchFilter] = useState<
    "all" | "trade" | "watch" | "pass"
  >("all");
  const [positionFilter, setPositionFilter] = useState<"open" | "settled">(
    "open",
  );
  const [search, setSearch] = useState("");
  const [opportunitySearch, setOpportunitySearch] = useState("");
  const [category, setCategory] = useState("All markets");
  const [selection, setSelection] = useState<{
    kind: "research" | "position";
    id: string;
    runId?: string;
  } | null>(null);
  const selectedResearch =
    selection?.kind === "research" && selection.runId === data.run?.id
      ? data.research.find((r) => r.id === selection.id)
      : undefined;
  const selectedPosition =
    selection?.kind === "position" && selection.runId === data.run?.id
      ? data.positions.find((p) => p.id === selection.id)
      : undefined;
  const setSelectedResearch = (item: DashboardResearch | null) =>
    setSelection(
      item ? { kind: "research", id: item.id, runId: data.run?.id } : null,
    );
  const setSelectedPosition = (item: DashboardPosition | null) =>
    setSelection(
      item ? { kind: "position", id: item.id, runId: data.run?.id } : null,
    );
  useEffect(() => {
    const syncView = () => {
      const hash = window.location.hash.slice(1);
      setView(
        hash === "positions"
          ? "overview"
          : hash === "markets"
            ? "opportunities"
            : Object.hasOwn(viewTitles, hash)
              ? (hash as View)
              : "overview",
      );
    };
    syncView();
    window.addEventListener("hashchange", syncView);
    return () => window.removeEventListener("hashchange", syncView);
  }, []);
  function navigate(next: View) {
    setView(next);
    window.location.hash = next;
  }
  const allResearch = useMemo(
    () =>
      [...data.research].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.research],
  );
  const research = allResearch.filter(
    (r) =>
      (researchFilter === "all" || r.decision === researchFilter) &&
      `${r.title} ${r.ticker} ${r.category}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const shortlist = useMemo(() => researchShortlist(data), [data]);
  const categories = [
    "All markets",
    ...new Set(shortlist.map((r) => r.category || "Uncategorized")),
  ];
  const opportunities = shortlist.filter(
    (r) =>
      (category === "All markets" ||
        (r.category || "Uncategorized") === category) &&
      `${r.title} ${r.ticker} ${r.category}`
        .toLowerCase()
        .includes(opportunitySearch.toLowerCase()),
  );
  const positions = [...data.positions]
    .filter((p) => p.status === positionFilter)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const values = portfolioValues(data);
  const risk = portfolioRisk(data);
  const unavailable = data.mode === "unavailable";
  const unconfigured = data.mode === "unconfigured";
  const demo = data.mode === "demo";
  const pending = unavailable || unconfigured;
  const modeLabel = demo
    ? "Illustrative demo"
    : unavailable
      ? "Data unavailable"
      : unconfigured
        ? "Awaiting setup"
        : data.mode === "local"
          ? "Local paper ledger"
          : "Paper trading";
  const researchCounts = {
    trade: data.research.filter((r) => r.decision === "trade").length,
    watch: data.research.filter((r) => r.decision === "watch").length,
    pass: data.research.filter((r) => r.decision === "pass").length,
  };
  const marks = data.positions
    .filter((p) => p.status === "open" && p.markAsOf)
    .map((p) => p.markAsOf!)
    .sort();
  const bidsStale =
    !demo &&
    marks.length > 0 &&
    Number.isFinite(Date.parse(data.observedAt ?? "")) &&
    Date.parse(data.observedAt!) - Date.parse(marks[0]) > 15 * 60000;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <a
          href="/"
          className="brand"
          aria-label="Blue prediction research home"
        >
          <span className="brandmark">b.</span>BLUE
          <span className="brand-sub">prediction lab</span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          {(["overview", "opportunities", "research", "activity"] as const).map(
            (v) => (
              <a
                key={v}
                href={`#${v}`}
                onClick={() => setView(v)}
                className={view === v ? "active" : ""}
                aria-current={view === v ? "page" : undefined}
              >
                {v === "overview"
                  ? "Overview"
                  : v === "opportunities"
                    ? "Opportunities"
                    : v === "research"
                      ? "Research"
                      : "Activity"}
                {v === "opportunities" && (
                  <span className="nav-count">{shortlist.length}</span>
                )}
              </a>
            ),
          )}
        </nav>
        <div className="header-status">
          <span
            className={`status-dot ${pending || refreshError || data.syncErrors?.length ? "is-pending" : ""}`}
          />
          <span>{modeLabel}</span>
          <span className="paper-tag">Paper only</span>
        </div>
      </header>

      <main id="main" className="dashboard-main">
        {demo && (
          <div className="mode-banner demo-banner">
            <div>
              <strong>Illustrative preview</strong>
              <span>
                All research, positions, and results here are fictional. No real
                paper trades were placed.
              </span>
            </div>
            <a href="/">
              View actual portfolio <Icon name="arrow" />
            </a>
          </div>
        )}
        {unconfigured && (
          <div className="mode-banner setup-banner">
            <div>
              <strong>Portfolio not connected</strong>
              <span>
                The initial paper allocation is shown. Connect storage to view
                actual balances and history.
              </span>
            </div>
            <span>Awaiting setup</span>
          </div>
        )}
        {unavailable && (
          <div className="mode-banner unavailable-banner" role="status">
            <div>
              <strong>Portfolio data is temporarily unavailable.</strong>
              <span>
                Balances and activity are hidden until the ledger can be read.
              </span>
            </div>
          </div>
        )}
        {data.mode === "local" && (
          <div className="mode-banner local-banner">
            <div>
              <strong>Local development ledger</strong>
              <span>
                This environment’s portfolio is separate from the deployed
                portfolio.
              </span>
            </div>
          </div>
        )}

        <section className="page-heading" aria-labelledby="page-title">
          <div>
            <div className="eyebrow">
              The {money(data.initialCashCents, 0)} experiment
              {data.run && (
                <>
                  <span className="eyebrow-divider">/</span>Started{" "}
                  {date(data.run.startedAt)}
                </>
              )}
            </div>
            <h1 id="page-title">{viewTitles[view]}</h1>
          </div>
          <div className="heading-actions">
            <span className="updated">
              Last market update ·{" "}
              {unavailable ? "Unavailable" : date(data.lastSyncAt, true)}
            </span>
            {!demo && (
              <button
                type="button"
                className="button refresh-button"
                onClick={() => void refresh()}
                disabled={refreshing}
                aria-label="Refresh portfolio"
              >
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
            )}
            {view === "overview" && (
              <button
                type="button"
                className="button primary-button"
                onClick={() => navigate("opportunities")}
              >
                Find opportunities <Icon name="arrow" />
              </button>
            )}
          </div>
        </section>

        {refreshError && (
          <div className="mode-banner unavailable-banner" role="status">
            <div>
              <strong>Portfolio refresh unavailable</strong>
              <span>
                Showing the last loaded portfolio. Prices may be outdated; try
                Refresh again.
              </span>
            </div>
          </div>
        )}
        {(data.syncErrors?.length ?? 0) > 0 && (
          <div className="mode-banner review-banner" role="status">
            <div>
              <strong>Market update needs attention</strong>
              <span>
                {data.syncErrors!.length} market updates failed. The last
                completed market update is {date(data.lastSyncAt, true)}.
              </span>
              <details>
                <summary>Show affected markets</summary>
                <ul>
                  {data.syncErrors!.map((error) => (
                    <li key={error.ticker}>
                      {error.ticker}: {error.message}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </div>
        )}
        {data.marketUpdateError && (
          <p className="section-note stale-note" role="status">
            {data.marketUpdateError}
          </p>
        )}
        {data.syncInProgress && (
          <p className="section-note" role="status">
            Market update in progress · {data.pendingSyncMarkets ?? 0} markets
            remaining
          </p>
        )}
        <section className="metrics-grid" aria-label="Portfolio summary">
          <div className="metric">
            <span className="label">Portfolio value</span>
            <strong>
              {values.totalValue === null ? "—" : money(values.totalValue)}
            </strong>
            <small>
              {pending
                ? "Awaiting portfolio data"
                : values.missingMarks
                  ? `${values.missingMarks} ${values.missingMarks === 1 ? "fill needs" : "fills need"} a recorded bid`
                  : "Cash + positions at recorded bids"}
            </small>
          </div>
          <div className="metric">
            <span className="label">Total profit</span>
            <strong
              className={
                values.totalProfit !== null && values.totalProfit > 0
                  ? "positive"
                  : values.totalProfit !== null && values.totalProfit < 0
                    ? "negative"
                    : ""
              }
            >
              {values.totalProfit === null
                ? "—"
                : signedMoney(values.totalProfit)}
            </strong>
            <small>
              {pending
                ? "Awaiting portfolio data"
                : `Realized ${signedMoney(data.realizedProfitCents)} · after fees`}
            </small>
          </div>
          <div className="metric">
            <span className="label">
              Open positions{" "}
              <span className="quiet-count">
                {pending ? "—" : data.openPositions}
              </span>
            </span>
            <strong>
              {values.openValue === null ? "—" : money(values.openValue)}
            </strong>
            <small>
              {pending
                ? "Awaiting portfolio data"
                : `${money(data.committedCents)} invested · fees included`}
            </small>
          </div>
          <div className="metric">
            <span className="label">
              {unconfigured ? "Starting paper cash" : "Available cash"}
            </span>
            <strong>{unavailable ? "—" : money(data.cashCents)}</strong>
            <small>
              {unconfigured
                ? "Initial allocation · ledger pending"
                : "Available for paper trades"}
            </small>
          </div>
        </section>
        <div className="portfolio-freshness">
          <Icon name="clock" />
          <span>
            {marks.length
              ? `Recorded bids · ${date(marks[0], true)}${date(marks[0], true) !== date(marks.at(-1), true) ? ` – ${date(marks.at(-1), true)}` : ""}`
              : "Market values appear when bids are recorded."}{" "}
            {demo
              ? "Illustrative prices."
              : "Updates automatically about every minute while this page is open."}{" "}
            {refreshedAt && `Portfolio reloaded ${date(refreshedAt, true)}.`}
          </span>
        </div>
        {bidsStale && (
          <p className="section-note stale-note" role="status">
            Prices are from an earlier market update. Automatic checks retry
            while this page is open; Refresh checks again.
          </p>
        )}

        {view === "overview" && (
          <>
            <PortfolioOverview
              data={data}
              shortlist={shortlist}
              onResearch={setSelectedResearch}
              onOpportunities={() => navigate("opportunities")}
            />
            <section
              className="positions-section"
              id="positions"
              aria-labelledby="positions-title"
            >
              <div className="section-heading">
                <div className="section-title">
                  <h2 id="positions-title">My bets</h2>
                  <span>
                    {pending
                      ? "Unavailable"
                      : `${data.openPositions} open · ${data.settledPositions} settled`}
                  </span>
                </div>
                <div
                  className="segments position-tabs"
                  role="group"
                  aria-label="Filter positions by status"
                >
                  {(["open", "settled"] as const).map((status) => (
                    <button
                      type="button"
                      key={status}
                      onClick={() => setPositionFilter(status)}
                      aria-pressed={positionFilter === status}
                    >
                      {status === "open" ? "Open" : "Settled"}{" "}
                      <span>
                        {status === "open"
                          ? data.openPositions
                          : data.settledPositions}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="panel positions-panel">
                {positions.length ? (
                  <PositionTable
                    positions={positions}
                    data={data}
                    onSelect={setSelectedPosition}
                  />
                ) : (
                  <EmptyState
                    title={
                      unavailable
                        ? "Positions are currently unavailable"
                        : positionFilter === "open"
                          ? "No open positions"
                          : "No settled positions"
                    }
                  >
                    {unavailable
                      ? "Position history returns when the ledger connection is restored."
                      : positionFilter === "open"
                        ? "Accepted paper trades will appear here."
                        : "Positions move here after official settlement."}
                  </EmptyState>
                )}
                <div className="table-footer">
                  <span>
                    Expected results are estimates. Open a market for close and
                    settlement times.
                  </span>
                  <span>
                    {positionFilter === "settled"
                      ? "Realized profit "
                      : "Open profit "}
                    <strong
                      className={
                        (positionFilter === "settled"
                          ? data.realizedProfitCents
                          : (values.openProfit ?? 0)) < 0
                          ? "negative"
                          : "positive"
                      }
                    >
                      {pending
                        ? "—"
                        : positionFilter === "settled"
                          ? signedMoney(data.realizedProfitCents)
                          : values.openProfit === null
                            ? "—"
                            : signedMoney(values.openProfit)}
                    </strong>
                  </span>
                </div>
              </div>
              <p className="section-note">
                <Icon name="shield" />
                Paper only. Each row is one fill. Bid valuations are snapshots,
                not cash-out offers; future exit fees are excluded.
              </p>
              <dl className="risk-strip" aria-label="Portfolio exposure">
                <div>
                  <dt>Distinct open markets</dt>
                  <dd>
                    {pending ? "—" : risk.markets}{" "}
                    <span>
                      across {pending ? "—" : data.openPositions} fills
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Starting capital invested</dt>
                  <dd>
                    {pending || risk.investedFraction === null
                      ? "—"
                      : `${(risk.investedFraction * 100).toFixed(2)}%`}
                  </dd>
                </div>
                <div>
                  <dt>Largest market · cost basis</dt>
                  <dd>
                    {pending || risk.largestMarketFraction === null
                      ? "—"
                      : `${(risk.largestMarketFraction * 100).toFixed(2)}%`}{" "}
                    <span>of starting capital</span>
                  </dd>
                </div>
              </dl>
            </section>
          </>
        )}

        {view === "opportunities" && (
          <section id="opportunities" aria-labelledby="opportunities-title">
            <div className="research-toolbar">
              <div
                className="filter-tabs"
                role="group"
                aria-label="Market category"
              >
                {categories.map((c) => (
                  <button
                    type="button"
                    key={c}
                    aria-pressed={category === c}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <label className="search-field">
                <Icon name="search" />
                <input
                  type="search"
                  aria-label="Search opportunities"
                  placeholder="Search opportunities"
                  value={opportunitySearch}
                  onChange={(e) => setOpportunitySearch(e.target.value)}
                />
              </label>
            </div>
            <div className="section-heading">
              <div className="section-title">
                <h2 id="opportunities-title">Research shortlist</h2>
                <span>
                  {opportunities.length}{" "}
                  {opportunities.length === 1 ? "market" : "markets"}
                </span>
              </div>
              <span className="updated">Latest published decisions</span>
            </div>
            <div className="opportunity-list">
              {opportunities.length ? (
                opportunities.map((r) => (
                  <article key={r.id} className="opportunity-card">
                    <div>
                      <div className="market-meta">
                        <span>{r.category || "Uncategorized"}</span>
                        <span className={`decision-badge ${r.decision}`}>
                          {decisionLabel(r)}
                        </span>
                      </div>
                      <h3>{r.title}</h3>
                      <p className="research-excerpt">{r.thesis}</p>
                    </div>
                    <div>
                      <div className="opportunity-numbers">
                        <span className={`side-badge ${r.side}`}>{r.side}</span>
                        <strong>{percent(r.probability)}</strong>
                        <span>our estimate</span>
                      </div>
                      <p className="muted">
                        {percent(r.probabilityLow)}–{percent(r.probabilityHigh)}{" "}
                        uncertainty range
                      </p>
                    </div>
                    <div className="opportunity-action">
                      <span className="muted">
                        Evidence {date(r.evidenceAsOf)}
                      </span>
                      <button
                        type="button"
                        className="text-button"
                        aria-haspopup="dialog"
                        onClick={() => setSelectedResearch(r)}
                      >
                        View research <Icon name="arrow" />
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState
                  title={
                    shortlist.length
                      ? "No matching opportunities"
                      : "No shortlisted markets"
                  }
                >
                  {shortlist.length ? (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setCategory("All markets");
                        setOpportunitySearch("");
                      }}
                    >
                      Clear filters
                    </button>
                  ) : (
                    "Published trade theses and watch decisions appear here."
                  )}
                </EmptyState>
              )}
            </div>
            <p className="section-note">
              Research estimates are dated forecasts. A trade thesis is a
              recommendation; a fresh quote and accepted paper fill are recorded
              separately.
            </p>
          </section>
        )}

        {view === "research" && (
          <section id="research" aria-labelledby="research-title">
            <div className="section-heading">
              <div className="section-title">
                <h2 id="research-title">Evidence behind every decision</h2>
                <span>{data.research.length} published briefs</span>
              </div>
              <span className="updated">Original forecasts stay on record</span>
            </div>
            <div className="research-toolbar">
              <div
                className="filter-tabs"
                role="group"
                aria-label="Filter research by decision"
              >
                {(["all", "trade", "watch", "pass"] as const).map((filter) => (
                  <button
                    type="button"
                    key={filter}
                    onClick={() => setResearchFilter(filter)}
                    aria-pressed={researchFilter === filter}
                  >
                    {filter === "all"
                      ? "All research"
                      : filter === "trade"
                        ? "Trade theses"
                        : filter === "watch"
                          ? "Watching"
                          : "Passed"}{" "}
                    <span>
                      {filter === "all"
                        ? data.research.length
                        : researchCounts[filter]}
                    </span>
                  </button>
                ))}
              </div>
              <label className="search-field">
                <Icon name="search" />
                <input
                  type="search"
                  aria-label="Search research markets"
                  placeholder="Find a market…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            </div>
            <div className="research-list">
              {research.length ? (
                research.map((item) => (
                  <ResearchCard
                    key={item.id}
                    item={item}
                    onOpen={() => setSelectedResearch(item)}
                  />
                ))
              ) : (
                <EmptyState
                  title={
                    unavailable
                      ? "Research is currently unavailable"
                      : data.research.length
                        ? "No matching research"
                        : "No research yet"
                  }
                >
                  {data.research.length ? (
                    <>
                      <p>Try another decision filter or search term.</p>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          setSearch("");
                          setResearchFilter("all");
                        }}
                      >
                        Clear filters
                      </button>
                    </>
                  ) : (
                    "Completed reviews appear here when published to the ledger."
                  )}
                </EmptyState>
              )}
            </div>
          </section>
        )}

        {view === "activity" && (
          <section id="activity" aria-labelledby="activity-title">
            <div className="section-heading">
              <div className="section-title">
                <h2 id="activity-title">Decision history</h2>
                <span>Research, fills, and results</span>
              </div>
              <a className="text-button" href="/api/ledger">
                Full ledger <Icon name="arrow" />
              </a>
            </div>
            <div className="panel">
              {data.activity.length ? (
                <ol className="activity-list">
                  {[...data.activity]
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                    .map((item) => {
                      const brief = data.research.find((r) => r.id === item.id);
                      return (
                        <li key={item.id}>
                          <time dateTime={item.createdAt}>
                            {date(item.createdAt, true)}
                          </time>
                          <span className="research-icon">
                            <Icon
                              name={
                                item.type === "research"
                                  ? "research"
                                  : item.type === "settlement"
                                    ? "check"
                                    : "activity"
                              }
                            />
                          </span>
                          <div>
                            <span className="activity-type">
                              {item.type.replaceAll("_", " ")}
                            </span>
                            <p>{item.description}</p>
                          </div>
                          {brief && (
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => setSelectedResearch(brief)}
                              aria-haspopup="dialog"
                            >
                              View research <Icon name="arrow" />
                            </button>
                          )}
                        </li>
                      );
                    })}
                </ol>
              ) : (
                <EmptyState
                  title={
                    unavailable ? "Activity unavailable" : "No activity yet"
                  }
                >
                  Research, trades, and settlements appear here.
                </EmptyState>
              )}
            </div>
            <p className="section-note">
              Latest {data.activity.length} ledger events · Last activity{" "}
              {date(data.lastActivityAt, true)}
            </p>
          </section>
        )}

        <footer className="footer">
          <span>
            <strong>BLUE</strong>
            <span className="footer-divider">/</span>Real markets. Imaginary
            money.
            <span className="footer-author">
              By{" "}
              <a
                href="https://mattvildibill.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Matt Vildibill
              </a>
            </span>
          </span>
          <div>
            <a href="/methodology">How it works</a>
            <a href="/api/ledger">View the ledger</a>
            <a href={demo ? "/" : "/demo"}>
              {demo ? "Actual portfolio" : "View demo"}
            </a>
          </div>
          <span className="footer-note">
            Paper trading only · Not affiliated with Kalshi
          </span>
        </footer>
      </main>
      {selectedResearch && (
        <ResearchPanel
          item={selectedResearch}
          onClose={() => setSelectedResearch(null)}
        />
      )}
      {selectedPosition && (
        <DetailDialog
          titleId="position-detail-title"
          label="Paper position / Recorded fill"
          onClose={() => setSelectedPosition(null)}
        >
          <h2 className="sr-only" id="position-detail-title">
            {selectedPosition.title}
          </h2>
          <PositionCard
            position={selectedPosition}
            runId={data.run?.id}
            demo={demo}
            research={data.research.find(
              (r) =>
                r.id === selectedPosition.researchId &&
                r.ticker === selectedPosition.ticker &&
                r.side === selectedPosition.side,
            )}
            initialCashCents={data.initialCashCents}
          />
        </DetailDialog>
      )}
    </div>
  );
}
