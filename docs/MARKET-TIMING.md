# Position schedules

Source: [Kalshi market lifecycle](https://docs.kalshi.com/getting_started/market_lifecycle) and [Get Market](https://docs.kalshi.com/api-reference/market/get-market).

- `close_time`: scheduled trading close, which may change.
- `expected_expiration_time`: expected time the outcome becomes known. It may precede trading close and is not guaranteed.
- `latest_expiration_time`: latest expiration, not a guaranteed payment deadline.
- Deprecated `expiration_time`: fallback only for latest expiration, never for expected outcome time. The UI identifies this fallback.
- `settlement_ts`: exchange settlement time, shown only for a finalized market. It is separate from the simulator's recorded `settledAt`.

No database migration or research/trade payload change is required. Optional `marketTiming` quote metadata and optional `marketTimings`/`marketTimingRetryAfter` snapshot maps coexist with older records. Nothing changes ledger accounting or settlement rules.

Quotes capture timing for new fills. Synchronization stores timing for open and closed markets, including final observations. The public held-position timing endpoint also refreshes the display cache when a card is opened on the dashboard, so existing positions do not require another trade or settlement run. It only accepts tickers already in the ledger, caches successful observations for 15 minutes, deduplicates simultaneous requests within an instance, and backs off failed refreshes for 60 seconds. Writes merge only cache fields into the current atomic snapshot; older observations cannot replace newer ones. Failed refreshes preserve original timestamps and show stale/error status.

Missing, malformed, or timezone-less official timestamps remain unavailable. New observations with missing fields do not silently retain obsolete dates. No date is parsed from research prose. Local display uses the browser timezone with an explicit UTC toggle; stored instants remain UTC. Refresh is on page load, not continuous monitoring.
