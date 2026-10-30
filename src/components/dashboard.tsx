"use client";

import { useMemo, useState } from "react";
import { ResearchText } from "./research-text";
import { PositionCard } from "./position-card";
import type { DashboardData, DashboardResearch } from "@/lib/dashboard-types";

type IconName =
  | "grid"
  | "research"
  | "positions"
  | "activity"
  | "arrow"
  | "chevron"
  | "search"
  | "external"
  | "shield"
  | "check"
  | "clock";
function Icon({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) {
  const paths: Record<IconName, React.ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    research: (
      <>
        <path d="M4 19.5V5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1 0-4h13M8 7h7M8 11h5" />
      </>
    ),
    positions: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
      </>
    ),
    activity: (
      <>
        <path d="M2 12h5l3-8 4 16 3-8h5" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14m-6-6 6 6-6 6" />
      </>
    ),
    chevron: <path d="m6 9 6 6 6-6" />,
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    external: (
      <>
        <path d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
      </>
    ),
    shield: (
      <>
        <path d="m12 3 8 3v5c0 5-8 10-8 10S4 16 4 11V6l8-3Z" />
        <path d="m8.5 11.5 2.5 2.5 4.5-5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  };
  return (
    <svg
      className={`icon ${className}`}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

const money = (cents: number, decimals = 0) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(cents / 100);
const signedMoney = (cents: number) =>
  `${cents > 0 ? "+" : ""}${money(cents, 2)}`;
const percent = (value: number) => `${Math.round(value * 100)}%`;
function date(value: string | null, withTime = false) {
  if (!value) return "Not yet recorded";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime
      ? { hour: "numeric", minute: "2-digit", timeZoneName: "short" as const }
      : {}),
    timeZone: "UTC",
  }).format(parsed);
}
function safeSource(url: string) {
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

function ResearchCard({
  item,
  expanded,
  onToggle,
}: {
  item: DashboardResearch;
  expanded: boolean;
  onToggle: () => void;
}) {
  const detailId = `research-${item.id}`;
  return (
    <article className={`research-card ${expanded ? "is-expanded" : ""}`}>
      <button
        className="research-card-trigger"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={detailId}
      >
        <div className="research-market">
          <div className="market-meta">
            <span>{item.category || "Uncategorized"}</span>
            <span className="meta-dot">·</span>
            <span>{date(item.createdAt)}</span>
          </div>
          <h3>{item.title}</h3>
        </div>
        <div className="research-probability">
          <span className="eyebrow">Estimated {item.side}</span>
          <strong>{percent(item.probability)}</strong>
          <span className="probability-range">
            {percent(item.probabilityLow)}–{percent(item.probabilityHigh)} range
          </span>
        </div>
        <div className="research-decision">
          <span className={`decision-badge ${item.decision}`}>
            {item.decision === "trade"
              ? "Trade thesis"
              : item.decision === "watch"
                ? "Watching"
                : "Passed"}
          </span>
          <span className="research-open-text">
            {expanded ? "Close analysis" : "Read analysis"}
          </span>
        </div>
        <Icon name="chevron" className="expand-chevron" />
      </button>
      {expanded && (
        <div className="research-detail" id={detailId}>
          <div className="detail-column thesis-column">
            <span className="eyebrow">The case</span>
            <ResearchText text={item.thesis} />
          </div>
          <div className="detail-column">
            <span className="eyebrow">The counterargument</span>
            <ResearchText text={item.counterThesis} />
          </div>
          <div className="detail-column">
            <span className="eyebrow">Sizing & review conditions</span>
            <ResearchText text={item.rationale} />
          </div>
          <div className="detail-column">
            <span className="eyebrow">Settlement criteria</span>
            <ResearchText text={item.resolutionCriteria} />
          </div>
          <div className="detail-sources">
            <span className="eyebrow">Sources & evidence</span>
            <div className="source-list">
              {item.sources.map((source, index) => {
                const href = safeSource(source.url);
                return href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    key={`${source.url}-${index}`}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {source.title}
                    <Icon name="external" />
                  </a>
                ) : (
                  <span className="invalid-source" key={index}>
                    {source.title} (link unavailable)
                  </span>
                );
              })}
            </div>
            <p className="evidence-time">
              Evidence as of {date(item.evidenceAsOf, true)}. Range reflects
              uncertainty in the selected-side estimate.
            </p>
            <details className="technical-details">
              <summary>Original research record</summary>
              <pre>{JSON.stringify(item, null, 2)}</pre>
            </details>
          </div>
        </div>
      )}
    </article>
  );
}

function EmptyState({
  icon,
  title,
  children,
}: {
  icon: IconName;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon name={icon} />
      </div>
      <h3>{title}</h3>
      <div className="empty-description">{children}</div>
    </div>
  );
}

export default function Dashboard({ data }: { data: DashboardData }) {
  const [researchFilter, setResearchFilter] = useState<
    "all" | "trade" | "watch" | "pass"
  >("all");
  const [positionFilter, setPositionFilter] = useState<"open" | "settled">(
    "open",
  );
  const [search, setSearch] = useState("");
  const [expandedResearch, setExpandedResearch] = useState<string | null>(null);
  const research = useMemo(
    () =>
      [...data.research]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .filter(
          (item) =>
            (researchFilter === "all" || item.decision === researchFilter) &&
            `${item.title} ${item.ticker} ${item.category}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        ),
    [data.research, researchFilter, search],
  );
  const positions = [...data.positions]
    .filter((position) => position.status === positionFilter)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unavailable = data.mode === "unavailable";
  const unconfigured = data.mode === "unconfigured";
  const demo = data.mode === "demo";
  const researchCounts = {
    trade: data.research.filter((item) => item.decision === "trade").length,
    watch: data.research.filter((item) => item.decision === "watch").length,
    pass: data.research.filter((item) => item.decision === "pass").length,
  };
  const modeLabel = demo
    ? "Illustrative demo"
    : unavailable
      ? "Data unavailable"
      : unconfigured
        ? "Awaiting setup"
        : data.mode === "local"
          ? "Local paper ledger"
          : "Paper ledger";

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <a
          href="/"
          className="brand"
          aria-label="Blue prediction research home"
        >
          <span className="brand-symbol">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>
            BLUE<span className="brand-period">.</span>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <a className="nav-link" href="#overview" aria-label="Overview">
            <Icon name="grid" />
            <span>Overview</span>
          </a>
          <a
            className="nav-link"
            href="#research"
            aria-label="Research journal"
          >
            <Icon name="research" />
            <span>Research</span>
            <span className="nav-count">{data.research.length}</span>
          </a>
          <a
            className="nav-link"
            href="#positions"
            aria-label="Paper positions"
          >
            <Icon name="positions" />
            <span>Positions</span>
            <span className="nav-count">{data.openPositions}</span>
          </a>
          <a className="nav-link" href="#activity" aria-label="Activity log">
            <Icon name="activity" />
            <span>Activity</span>
          </a>
        </nav>
        <div className="sidebar-bottom">
          <a className="sidebar-demo-link" href={demo ? "/" : "/demo"}>
            {demo ? "Back to portfolio" : "View demo"}
            <Icon name="arrow" />
          </a>
          <div className="sidebar-author">
            <span className="author-avatar">MV</span>
            <div>
              Matt Vildibill<span>Personal research project</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span>BLUE</span>
            <span>/</span>Kalshi paper trading
          </div>
          <div className="topbar-status">
            <span
              className={`status-dot ${unavailable || unconfigured ? "is-pending" : ""}`}
            />
            <span>{modeLabel}</span>
            <span className="paper-tag">Paper only</span>
          </div>
        </header>
        <main id="main">
          {demo && (
            <div className="mode-banner demo-banner">
              <div>
                <strong>Illustrative preview</strong>
                <span>
                  All research, positions, and results on this page are sample
                  data. No real paper trades were placed.
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
                  The starting balance is shown below. Portfolio history is
                  unavailable until storage is connected.
                </span>
              </div>
              <span className="banner-label">Not connected</span>
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
                  This portfolio belongs to this development environment. It is
                  separate from the deployed portfolio.
                </span>
              </div>
            </div>
          )}

          <section
            className="page-heading"
            id="overview"
            aria-labelledby="portfolio-title"
          >
            <h1 id="portfolio-title">Portfolio</h1>
            <a href={demo ? "/" : "/demo"}>
              {demo ? "Back to portfolio" : "View demo"} <Icon name="arrow" />
            </a>
          </section>
          <div className="portfolio-freshness">
            <Icon name="clock" />
            {data.run && !demo && (
              <span>Started {date(data.run.startedAt, true)}</span>
            )}
            <span>
              Last settlement check:{" "}
              {unavailable ? "Unavailable" : date(data.lastSyncAt, true)}
            </span>
          </div>

          <section className="metrics-grid" aria-label="Portfolio summary">
            <div className="metric-card primary-metric">
              <div className="metric-top">
                <span className="eyebrow">
                  {unconfigured
                    ? "Starting paper cash"
                    : "Available paper cash"}
                </span>
                <span className="metric-currency">USD</span>
              </div>
              <strong className="metric-value">
                {unavailable ? "—" : money(data.cashCents, 2)}
              </strong>
              <span className="metric-caption">
                {unconfigured
                  ? "Initial allocation · ledger pending"
                  : "Available for paper trades"}
              </span>
            </div>
            <div className="metric-card">
              <div className="metric-top">
                <span className="eyebrow">Open position cost</span>
                <Icon name="positions" />
              </div>
              <strong className="metric-value">
                {unavailable
                  ? "—"
                  : money(
                      data.committedCents,
                      data.committedCents % 100 ? 2 : 0,
                    )}
              </strong>
              <span className="metric-caption">
                {unavailable
                  ? "Awaiting portfolio data"
                  : `${data.openPositions} open ${data.openPositions === 1 ? "position" : "positions"} · includes entry fees`}
              </span>
            </div>
            <div className="metric-card">
              <div className="metric-top">
                <span className="eyebrow">Realized return</span>
                <Icon name="activity" />
              </div>
              <strong
                className={`metric-value ${data.realizedProfitCents > 0 ? "positive" : data.realizedProfitCents < 0 ? "negative" : ""}`}
              >
                {unavailable ? "—" : signedMoney(data.realizedProfitCents)}
              </strong>
              <span className="metric-caption">
                {unavailable
                  ? "Awaiting portfolio data"
                  : `${data.settledPositions} settled ${data.settledPositions === 1 ? "position" : "positions"} · after estimated fees`}
              </span>
            </div>
          </section>

          <section
            className="positions-section"
            id="positions"
            aria-labelledby="positions-title"
          >
            <div className="section-heading">
              <div>
                <h2 id="positions-title">Paper positions</h2>
              </div>
              <div
                className="position-tabs"
                role="group"
                aria-label="Filter positions by status"
              >
                <button
                  onClick={() => setPositionFilter("open")}
                  aria-pressed={positionFilter === "open"}
                  className={positionFilter === "open" ? "active" : ""}
                >
                  Open <span>{data.openPositions}</span>
                </button>
                <button
                  onClick={() => setPositionFilter("settled")}
                  aria-pressed={positionFilter === "settled"}
                  className={positionFilter === "settled" ? "active" : ""}
                >
                  Settled <span>{data.settledPositions}</span>
                </button>
              </div>
            </div>
            <div className="positions-panel">
              {positions.length ? (
                <div className="position-grid">
                  {positions.map((position) => (
                    <PositionCard
                      key={`${data.run?.id ?? "initial-run"}:${position.id}`}
                      position={position}
                      runId={data.run?.id}
                      demo={demo}
                      research={data.research.find(
                        (r) =>
                          r.id === position.researchId &&
                          r.ticker === position.ticker &&
                          r.side === position.side,
                      )}
                      initialCashCents={data.initialCashCents}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon="positions"
                  title={
                    unavailable
                      ? "Positions are currently unavailable"
                      : positionFilter === "open"
                        ? "No open positions"
                        : "No settled positions"
                  }
                >
                  {unavailable
                    ? "Position history will return when the ledger connection is restored."
                    : positionFilter === "open"
                      ? "Accepted paper trades will appear here."
                      : "Positions move here after official settlement."}
                </EmptyState>
              )}
              <div className="positions-footnote">
                <Icon name="shield" />
                <span>
                  Paper trades only. Cost includes modeled fees; open cost is
                  not market value.
                </span>
              </div>
            </div>
          </section>

          <section
            className="journal-section"
            id="research"
            aria-labelledby="research-title"
          >
            <div className="section-heading">
              <div>
                <h2 id="research-title">
                  Research journal
                  <span className="heading-count">{data.research.length}</span>
                </h2>
              </div>
            </div>
            <div className="research-toolbar">
              <div
                className="filter-tabs"
                role="group"
                aria-label="Filter research by decision"
              >
                {(["all", "trade", "watch", "pass"] as const).map((filter) => (
                  <button
                    key={filter}
                    className={researchFilter === filter ? "active" : ""}
                    onClick={() => setResearchFilter(filter)}
                    aria-pressed={researchFilter === filter}
                  >
                    {filter === "all"
                      ? "All research"
                      : filter === "trade"
                        ? "Trade theses"
                        : filter === "watch"
                          ? "Watching"
                          : "Passed"}
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
                  placeholder="Find a market…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Search research markets"
                />
              </label>
            </div>
            <div className="research-list">
              {research.length ? (
                research.map((item) => (
                  <ResearchCard
                    key={item.id}
                    item={item}
                    expanded={expandedResearch === item.id}
                    onToggle={() =>
                      setExpandedResearch(
                        expandedResearch === item.id ? null : item.id,
                      )
                    }
                  />
                ))
              ) : (
                <EmptyState
                  icon="research"
                  title={
                    data.research.length
                      ? "No matching research"
                      : unavailable
                        ? "Research is currently unavailable"
                        : "No research yet"
                  }
                >
                  {data.research.length
                    ? "Try another decision filter or search term."
                    : unavailable
                      ? "The journal will return when the ledger connection is restored."
                      : "Completed reviews will appear here."}
                  {data.research.length > 0 && (
                    <button
                      className="clear-filters"
                      onClick={() => {
                        setSearch("");
                        setResearchFilter("all");
                      }}
                    >
                      Clear filters
                    </button>
                  )}
                </EmptyState>
              )}
            </div>
          </section>

          <div className="bottom-grid">
            <section
              className="activity-panel panel"
              id="activity"
              aria-labelledby="activity-title"
            >
              <div className="activity-heading">
                <h2 id="activity-title">Latest activity</h2>
                <Icon name="activity" />
              </div>
              {data.activity.length ? (
                <ol className="activity-list">
                  {[...data.activity]
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                    .slice(0, 6)
                    .map((item) => (
                      <li key={item.id}>
                        <span className="activity-node" />
                        <div>
                          <span className="activity-type">
                            {item.type.replaceAll("_", " ")}
                          </span>
                          <p>{item.description}</p>
                          <time dateTime={item.createdAt}>
                            {date(item.createdAt, true)}
                          </time>
                        </div>
                      </li>
                    ))}
                </ol>
              ) : (
                <div className="activity-empty">
                  <span className="activity-node" />
                  <div>
                    <strong>
                      {unavailable ? "Activity unavailable" : "No activity yet"}
                    </strong>
                    <p>
                      {unavailable
                        ? "Waiting for the ledger connection."
                        : "Research, trades, and settlements appear here."}
                    </p>
                  </div>
                </div>
              )}
              <div className="last-update">
                <Icon name="clock" />
                <div>
                  <span>Last ledger activity</span>
                  <strong>{date(data.lastActivityAt, true)}</strong>
                </div>
              </div>
            </section>
          </div>
          <footer className="footer">
            <div>
              <span className="footer-brand">BLUE.</span>
              <span>
                By{" "}
                <a
                  href="https://mattvildibill.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Matt Vildibill
                  <Icon name="external" />
                </a>
              </span>
            </div>
            <p>
              <a href="/methodology">How it works</a> ·{" "}
              <a href="/api/ledger">View the ledger</a>
              <br />
              Paper trading only. Not affiliated with Kalshi.
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
