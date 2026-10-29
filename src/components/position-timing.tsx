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
function refresh(ticker: string) {
  const existing = pending.get(ticker);
  if (existing) return existing;
  const request = fetch(`/api/positions/${encodeURIComponent(ticker)}/timing`, {
    signal: AbortSignal.timeout(15000),
  })
    .then(async (res) => {
      const body = await res.json();
      if (!body || typeof body.stale !== "boolean")
        throw new Error("Schedule unavailable");
      return body as TimingResponse;
    })
    .finally(() => pending.delete(ticker));
  pending.set(ticker, request);
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
export function PositionTiming({
  position: p,
  demo = false,
}: {
  position: DashboardPosition;
  demo?: boolean;
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
    refresh(p.ticker)
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
  }, [p.ticker, p.marketTiming, demo]);
  const format = (value?: string | null) => formatSchedule(value, timezone);
  const unavailable = !timing;
  return (
    <section className="position-timing" aria-label="Market schedule">
      <div className="timing-controls">
        <span>Times: {timezone}</span>
        {localZone !== "UTC" && (
          <button
            type="button"
            onClick={() => setTimezone(timezone === "UTC" ? localZone : "UTC")}
          >
            {timezone === "UTC" ? "Use local time" : "Use UTC"}
          </button>
        )}
      </div>
      <dl className="bet-timing">
        <div>
          <dt>Trading closes · scheduled</dt>
          <dd>{format(timing ? timing.closesAt : p.closesAt)}</dd>
        </div>
        <div>
          <dt>Expected result · estimate</dt>
          <dd>
            {unavailable
              ? loading
                ? "Loading official schedule…"
                : "Schedule unavailable"
              : format(timing.expectedResultAt)}
          </dd>
        </div>
        <div>
          <dt>Latest expiration</dt>
          <dd>
            {unavailable
              ? loading
                ? "Loading official schedule…"
                : "Schedule unavailable"
              : format(timing.latestExpirationAt)}
          </dd>
        </div>
        {timing?.exchangeSettledAt && (
          <div>
            <dt>Exchange settled</dt>
            <dd>{format(timing.exchangeSettledAt)}</dd>
          </div>
        )}
        {p.status === "settled" && (
          <div>
            <dt>Recorded in paper ledger</dt>
            <dd>{format(p.settledAt)}</dd>
          </div>
        )}
      </dl>
      <p className="bet-note">
        Expected result is an estimate. Latest expiration is not a guaranteed
        payout deadline; disputes and settlement processing may delay funds.
      </p>
      {timing && (
        <p className="bet-note">
          Schedule checked {format(timing.observedAt)}
          {stale ? " · stale" : ""}
          {timing.latestExpirationSource === "expiration_time"
            ? " · latest expiration uses Kalshi’s legacy field"
            : ""}
          .{" "}
          <a href={timing.sourceUrl} target="_blank" rel="noopener noreferrer">
            {demo ? "Timing field definitions" : "Official market"}
          </a>
        </p>
      )}
      {timing?.exchangeSettledAt && p.status === "open" && (
        <p className="bet-note">
          Exchange finalized; paper portfolio settlement pending.
        </p>
      )}
      {error && (
        <p className="timing-error" role="status">
          Schedule refresh unavailable.{" "}
          {timing
            ? "Showing the previously recorded schedule."
            : "No result time inferred."}
        </p>
      )}
    </section>
  );
}
