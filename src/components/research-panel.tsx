import type { DashboardResearch } from "@/lib/dashboard-types";
import { ResearchText } from "./research-text";
import { date, DetailDialog, Icon, percent } from "./dashboard-ui";

export function decisionLabel(item: DashboardResearch) {
  return item.decision === "trade"
    ? "Trade thesis"
    : item.decision === "watch"
      ? "Watching"
      : "Passed";
}

export function ResearchCard({
  item,
  onOpen,
}: {
  item: DashboardResearch;
  onOpen: () => void;
}) {
  return (
    <article className="research-card">
      <span className="research-icon">
        <Icon name="research" />
      </span>
      <div className="research-market">
        <div className="market-meta">
          <span>
            {item.category || "Uncategorized"} · {date(item.createdAt)}
          </span>
          <span className={`decision-badge ${item.decision}`}>
            {decisionLabel(item)}
          </span>
        </div>
        <h3>{item.title}</h3>
        <p className="research-excerpt">{item.thesis}</p>
        <div className="market-subline">
          <span className={`side-badge ${item.side}`}>{item.side}</span>
          <span>Our estimate {percent(item.probability)}</span>
          <span>
            {percent(item.probabilityLow)}–{percent(item.probabilityHigh)} range
          </span>
        </div>
      </div>
      <button
        type="button"
        className="button research-card-trigger"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-label={`Read analysis: ${item.title}`}
      >
        Read <Icon name="arrow" />
      </button>
    </article>
  );
}

export function ResearchPanel({
  item,
  onClose,
}: {
  item: DashboardResearch;
  onClose: () => void;
}) {
  return (
    <DetailDialog
      titleId="research-detail-title"
      label="Market research / Published brief"
      onClose={onClose}
    >
      <div className="research-detail">
        <div className="market-meta">
          <span>{item.category || "Uncategorized"}</span>
          <span className={`decision-badge ${item.decision}`}>
            {decisionLabel(item)}
          </span>
        </div>
        <h2 id="research-detail-title">{item.title}</h2>
        <p className="detail-meta">
          {item.ticker} · Published {date(item.createdAt, true)}
        </p>
        <div className="detail-quote">
          <div>
            <span className="label">Selected side</span>
            <strong>{item.side.toUpperCase()}</strong>
            <small>Forecast for this outcome</small>
          </div>
          <div>
            <span className="label">Our estimate</span>
            <strong>{percent(item.probability)}</strong>
            <small>Research estimate</small>
          </div>
          <div>
            <span className="label">Uncertainty range</span>
            <strong>
              {percent(item.probabilityLow)}–{percent(item.probabilityHigh)}
            </strong>
            <small>Not a confidence score</small>
          </div>
        </div>
        <section className="detail-section">
          <h3>The case</h3>
          <ResearchText text={item.thesis} />
        </section>
        <section className="detail-section counterargument">
          <h3>The counterargument</h3>
          <ResearchText text={item.counterThesis} />
        </section>
        <section className="detail-section">
          <h3>Sizing & review conditions</h3>
          <ResearchText text={item.rationale} />
        </section>
        <section className="detail-section">
          <h3>Settlement criteria</h3>
          <ResearchText text={item.resolutionCriteria} />
        </section>
        <section className="detail-section">
          <h3>Evidence & rules</h3>
          <div className="source-list">
            {item.sources.map((source, i) => {
              let href: string | null = null;
              try {
                const parsed = new URL(source.url);
                if (["https:", "http:"].includes(parsed.protocol))
                  href = parsed.href;
              } catch {
                /* Retain the title when a source URL is invalid. */
              }
              return href ? (
                <a
                  key={`${source.url}-${i}`}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="research" />
                  <span>{source.title}</span>
                  <Icon name="arrow" />
                </a>
              ) : (
                <span key={i}>{source.title} (link unavailable)</span>
              );
            })}
          </div>
          {!item.sources.length && (
            <p className="detail-meta">No sources recorded.</p>
          )}
          <p className="evidence-time">
            Evidence as of {date(item.evidenceAsOf, true)}. Check the publisher,
            date, and support for each claim; source count is not confidence.
          </p>
        </section>
        <details className="technical-details">
          <summary>Original research record</summary>
          <pre>{JSON.stringify(item, null, 2)}</pre>
        </details>
      </div>
      <div className="detail-foot">
        <Icon name="shield" />
        Published research is a forecast. Paper trades require a fresh
        server-verified quote.
      </div>
    </DetailDialog>
  );
}
