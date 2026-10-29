export const productionOrigin = "https://kalshi.mattvildibill.com";

export function connection(env, local = false) {
  let url;
  try {
    url = new URL(env.BLUE_BASE_URL);
  } catch {
    throw new Error(
      "Set BLUE_BASE_URL in environment settings; no file or localhost fallback is used.",
    );
  }
  const allowed = local
    ? url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    : url.origin === productionOrigin;
  if (
    !allowed ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "BLUE_BASE_URL must be the project's production origin (or explicit --local loopback origin).",
    );
  return { origin: url.origin, key: env.BLUE_API_KEY, local };
}

export function client(config, fetcher = fetch) {
  return async function request(
    path,
    {
      method = "GET",
      body,
      authenticated = true,
      expectUnauthorized = false,
    } = {},
  ) {
    if (authenticated && !config.key)
      throw new Error(
        "BLUE_API_KEY is missing. Configure its secure environment binding; do not use a workspace credential file.",
      );
    const endpoint = new URL(path, config.origin);
    if (
      endpoint.origin !== config.origin ||
      endpoint.username ||
      endpoint.password
    )
      throw new Error(
        "Refusing to send credentials outside the configured origin.",
      );
    const headers = { Accept: "application/json" };
    if (authenticated) headers.Authorization = `Bearer ${config.key}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    let response;
    try {
      response = await fetcher(endpoint, {
        method,
        body,
        headers,
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(65_000),
      });
    } catch {
      throw new Error(
        "Request failed. Check connectivity; retry writes with the SAME idempotency key.",
      );
    }
    if (expectUnauthorized) {
      if (response.status !== 401)
        throw new Error(
          "Authenticated portfolio endpoint did not reject a missing credential.",
        );
      return;
    }
    if (!response.ok) {
      let detail = "";
      try {
        const { error } = await response.json();
        if (
          typeof error?.code === "string" &&
          /^[A-Z0-9_]{1,80}$/.test(error.code)
        )
          detail = ` ${error.code}`;
        if (typeof error?.message === "string")
          detail += `: ${(config.key ? error.message.replaceAll(config.key, "[REDACTED]") : error.message).slice(0, 1000).replace(/[\x00-\x1f\x7f]/g, " ")}`;
      } catch {
        /* Never dump malformed responses, headers, or credentials. */
      }
      const message = `API request failed (HTTP ${response.status}).${detail}`;
      throw new Error(
        config.key ? message.replaceAll(config.key, "[REDACTED]") : message,
      );
    }
    try {
      return await response.json();
    } catch {
      throw new Error("API returned an invalid JSON response.");
    }
  };
}

export async function verify(config, fetcher = fetch) {
  if (!config.key)
    throw new Error(
      "BLUE_API_KEY is missing. Configure its secure environment binding before verification.",
    );
  const request = client(config, fetcher);
  const health = await request("/api/health", { authenticated: false });
  const mode = config.local ? "local" : "live";
  if (
    health.status !== "ready" ||
    health.blueConfigured !== true ||
    (!config.local && health.database !== true)
  )
    throw new Error("Application health is not ready.");
  await request("/api/blue/portfolio", {
    authenticated: false,
    expectUnauthorized: true,
  });
  const before = await request("/api/blue/portfolio");
  if (before.mode !== mode)
    throw new Error(
      "Portfolio storage does not match the requested environment.",
    );
  let cursor;
  let checked = 0;
  let settled = 0;
  const deadline = Date.now() + 10 * 60_000;
  for (let page = 1; page <= 1000 && Date.now() < deadline; page++) {
    const path = new URL("/api/sync", config.origin);
    if (cursor) path.searchParams.set("cursor", cursor);
    const sync = await request(path.pathname + path.search, { method: "POST" });
    if (
      !Array.isArray(sync.errors) ||
      sync.errors.length ||
      !Number.isInteger(sync.checked) ||
      sync.checked < 0 ||
      !Number.isInteger(sync.settled) ||
      sync.settled < 0
    )
      throw new Error(
        "Synchronization returned errors or an invalid result; inspect the sync endpoint before resuming research.",
      );
    checked += sync.checked;
    settled += sync.settled;
    if (sync.complete === true && sync.nextCursor === null) {
      const after = await request("/api/blue/portfolio");
      const observed = Date.parse(sync.observedAt);
      const persisted = Date.parse(after.lastSyncAt);
      if (
        after.mode !== mode ||
        !Number.isFinite(observed) ||
        !Number.isFinite(persisted) ||
        persisted < observed
      )
        throw new Error(
          "Synchronization was not confirmed by a subsequent authenticated portfolio read.",
        );
      return {
        verified: true,
        origin: config.origin,
        credentialSource: "process environment",
        authenticatedPortfolio: true,
        unauthenticatedPortfolioRejected: true,
        sync: {
          complete: true,
          pages: page,
          checked,
          settled,
          observedAt: sync.observedAt,
          persistedLastSyncAt: after.lastSyncAt,
        },
        cashCents: after.cashCents,
        openPositions: after.openPositions,
        // The task runner must establish freshness; this process cannot attest it.
        freshTaskVerified:
          "Requires independent task/runtime evidence; this report alone does not establish freshness.",
      };
    }
    if (
      sync.complete !== false ||
      typeof sync.nextCursor !== "string" ||
      !sync.nextCursor
    )
      throw new Error(
        "Synchronization is incomplete without a usable continuation cursor.",
      );
    cursor = sync.nextCursor;
  }
  throw new Error(
    "Synchronization exceeded the verification budget; completion was not verified.",
  );
}
