"use client";
import { useEffect, useState } from "react";
import type { DashboardPosition } from "@/lib/dashboard-types";
import { timingIsFresh, type MarketTiming } from "@/lib/market-timing";

type TimingResponse = {
  timing: MarketTiming | null;
  stale: boolean;
  error?: string;
};
const pending = new Map<string, Promise<TimingResponse>>();
function refresh(ticker: string, runId?: string) {
  const key = `${runId}:${ticker}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const request = fetch(
    `/api/positions/${encodeURIComponent(ticker)}/timing${runId ? `?runId=${encodeURIComponent(runId)}` : ""}`,
    {
      signal: AbortSignal.timeout(15000),
    },
  )
    .then(async (res) => {
      const body = await res.json();
      if (!body || typeof body.stale !== "boolean")
        throw new Error("Schedule unavailable");
      return body as TimingResponse;
    })
    .finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}
export function formatSchedule(
  value: string | null | undefined,
  timezone: string,
) {
  return value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: timezone,
        timeZoneName: "short",
      }).format(new Date(value))
    : "Not supplied by Kalshi";
}
function usePositionSchedule({
  position: p,
  demo = false,
  runId,
}: {
  position: DashboardPosition;
  demo?: boolean;
  runId?: string;
}) {
  const [timing, setTiming] = useState(p.marketTiming);
  const [error, setError] = useState(false);
  const [timezone, setTimezone] = useState("UTC");
  const [localZone, setLocalZone] = useState("UTC");
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setLocalZone(zone);
    setTimezone(zone);
  }, []);
  useEffect(() => {
    let active = true;
    if (demo) return;
    setError(false);
    setLoading(false);
    setStale(!timingIsFresh(p.marketTiming));
    if (timingIsFresh(p.marketTiming)) {
      setTiming(p.marketTiming);
      return;
    }
    setLoading(true);
    refresh(p.ticker, runId)
      .then((result) => {
        if (!active) return;
        if (result.timing) setTiming(result.timing);
        setStale(result.stale);
        setError(Boolean(result.error));
      })
      .catch(() => {
        if (active) {
          setError(true);
          setStale(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [p.ticker, p.marketTiming, demo, runId]);
  return { timing, error, timezone, localZone, stale, loading, setTimezone };
}

export function PositionResultDate(props: {
  position: DashboardPosition;
  demo?: boolean;
  runId?: string;
}) {
  const { timing, timezone, stale, loading, error } =
    usePositionSchedule(props);
  const value =
    props.position.status === "settled"
      ? props.position.settledAt
      : timing?.expectedResultAt;
  const valid = value && Number.isFinite(Date.parse(value));
  return valid ? (
    <span
      className="result-date"
      title={`${formatSchedule(value, timezone)}${stale ? " · recorded schedule may be stale" : ""}${error ? " · refresh unavailable" : ""}`}
    >
      <time dateTime={value}>
        {new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          timeZone: timezone,
        }).format(new Date(value))}
      </time>
      <span>
        {new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
          timeZone: timezone,
        }).format(new Date(value))}
      </span>
      {props.position.status === "open" && (
        <small>{stale ? "Estimate · stale" : "Estimate"}</small>
      )}
    </span>
  ) : (
    <span className="muted">
      {loading ? "Checking schedule…" : "Not supplied"}
    </span>
  );
}

export function PositionTiming(props: {
  position: DashboardPosition;
  demo?: boolean;
  runId?: string;
}) {
  const { position: p, demo = false } = props;
  const { timing, error, timezone, localZone, stale, loading, setTimezone } =
    usePositionSchedule(props);
  const format = (value?: string | null) => formatSchedule(value, timezone);
  const validDate = (value?: string | null) =>
    Boolean(value && Number.isFinite(Date.parse(value)));
  const closesAt = timing ? timing.closesAt : p.closesAt;
  const primaryDate =
    p.status === "settled"
      ? p.settledAt
      : validDate(timing?.expectedResultAt)
        ? timing?.expectedResultAt
        : closesAt;
  const primaryLabel =
    p.status === "settled"
      ? "Settlement recorded"
      : validDate(timing?.expectedResultAt)
        ? "Expected result · estimated"
        : "Trading closes · result time unavailable";
  const compactDate = (value: string) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
      timeZoneName: "short",
    }).format(new Date(value));
  const ledgerDate = (value?: string | null) =>
    validDate(value) ? format(value) : "Not recorded";
  return (
    <section className="position-timing" aria-label="Market schedule">
      <p className="timing-primary">
        {validDate(primaryDate) ? (
          <>
            <span>{primaryLabel}</span>{" "}
            <time dateTime={primaryDate!} title={format(primaryDate)}>
              {compactDate(primaryDate!)}
            </time>
          </>
        ) : (
          <span>
            {p.status === "settled"
              ? "Settlement date not recorded"
              : loading
                ? "Loading schedule…"
                : "Result time unavailable"}
          </span>
        )}
      </p>
      {error ? (
        <p className="timing-error" role="status">
          Schedule refresh unavailable{timing ? " · showing saved dates" : ""}.
        </p>
      ) : (
        stale &&
        timing && (
          <p className="timing-error" role="status">
            Saved schedule · may be outdated.
          </p>
        )
      )}
      {timing?.exchangeSettledAt && p.status === "open" && (
        <p className="bet-note">Exchange settled · portfolio update pending.</p>
      )}
      <details className="timing-details">
        <summary>Dates</summary>
        <div className="timing-controls">
          <span>Times: {timezone}</span>
          {localZone !== "UTC" && (
            <button
              type="button"
              onClick={() =>
                setTimezone(timezone === "UTC" ? localZone : "UTC")
              }
            >
              {timezone === "UTC" ? "Use local time" : "Use UTC"}
            </button>
          )}
        </div>
        <dl className="bet-timing">
          <div>
            <dt>Entered</dt>
            <dd>{ledgerDate(p.createdAt)}</dd>
          </div>
          <div>
            <dt>Trading closes · scheduled</dt>
            <dd>{format(closesAt)}</dd>
          </div>
          <div>
            <dt>Expected result · estimate</dt>
            <dd>
              {timing
                ? format(timing.expectedResultAt)
                : "Schedule unavailable"}
            </dd>
          </div>
          <div>
            <dt>Latest expiration</dt>
            <dd>
              {timing
                ? format(timing.latestExpirationAt)
                : "Schedule unavailable"}
            </dd>
          </div>
          <div>
            <dt>Exchange settled</dt>
            <dd>
              {timing?.exchangeSettledAt
                ? format(timing.exchangeSettledAt)
                : "Not recorded"}
            </dd>
          </div>
          <div>
            <dt>Recorded in paper ledger</dt>
            <dd>
              {p.status === "settled" ? ledgerDate(p.settledAt) : "Not settled"}
            </dd>
          </div>
          <div>
            <dt>Schedule checked</dt>
            <dd>
              {timing ? format(timing.observedAt) : ledgerDate(p.timingAsOf)}
              {stale && timing ? " · stale" : ""}
            </dd>
          </div>
        </dl>
        <p className="bet-note">
          Expected result is an estimate. Latest expiration is not a guaranteed
          payout deadline; disputes and settlement processing may delay funds.
        </p>
        {timing?.latestExpirationSource === "expiration_time" && (
          <p className="bet-note">
            Latest expiration uses Kalshi’s legacy field.
          </p>
        )}
        {timing && (
          <a
            className="timing-source"
            href={timing.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {demo ? "Timing field definitions" : "Official market"}
          </a>
        )}
      </details>
    </section>
  );
}
