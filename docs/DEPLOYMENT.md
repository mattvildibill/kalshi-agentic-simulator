# Deploy only this project

Target repository: `mattvildibill/kalshi-agentic-simulator`.
Target public domain: `kalshi.mattvildibill.com`.

Do not edit the existing `mattvildibill.com` deployment, other repositories, other databases, account-wide settings, apex DNS, or existing subdomains. Create dedicated resources. Do not subscribe, start a paid trial, add a payment method, or enable paid overages.

## 1. Dedicated Supabase Free project

Create a new project named `kalshi-agentic-simulator` on the ongoing **Free** plan. Verify the current plan terms in the dashboard. If no free project slot is available, stop; do not upgrade or remove an existing project.

Run [`supabase/schema.sql`](../supabase/schema.sql) in that new project's SQL Editor. It creates only `public.blue_portfolio`, enables row-level security, and denies direct access to anonymous/ordinary authenticated users. Re-running does not reset the portfolio. The first successful application read initializes the paper ledger atomically.

Copy the project URL and its server-only `service_role` key (legacy JWT service-role API key) into Vercel environment settings. Do not use the anonymous/publishable key. Never paste keys into chat, source, or public screenshots. The app accesses PostgREST over HTTPS, avoiding a separate database connection pool.

The SQL is intentionally inspectable; `npm run db:init` prints it and does not execute it against an account automatically. For a backup, export the dedicated `blue_portfolio` row securely before schema migrations. Free plans may pause inactive projects or apply quotas; the app reports unavailable storage and refuses writes rather than resetting cash.

## 2. Dedicated Vercel project

Import the existing `mattvildibill/kalshi-agentic-simulator` GitHub repository as a new Vercel project. Use the free personal/Hobby scope if permitted by current terms; do not change another project's plan or settings.

- Framework: Next.js (autodetected).
- Root directory: repository root.
- Install: `npm ci`.
- Build: `npm run build`.
- Node.js: 24.x (22+ supported).
- No cron job, model provider, or billable integration is needed.

Set these **server-only** environment variables for production:

- `SUPABASE_URL`: the dedicated project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: the dedicated service-role key.
- `BLUE_API_KEY`: a cryptographically random secret of at least 32 characters.

Generate `BLUE_API_KEY` using a password manager or another secure secret-generation flow. Configure the same key in Blue's secure execution environment. Never give it a `NEXT_PUBLIC_` prefix. Do not put `STORAGE_MODE=local` in Vercel. Do not point preview deployments at the production database: leave preview storage unconfigured unless a separately isolated free test database is available.

Deploy. The homepage may load without storage configured, but will visibly report setup pending. That is not a completed integration.

## 3. Verify before enabling paper trades

1. `GET /api/health` must return HTTP 200 with `database: true`, `blueConfigured: true`, and `storage: "live"`.
2. `GET /api/portfolio` must show $100,000 initial paper cash and an empty real portfolio on a brand-new database.
3. An unauthenticated `POST /api/research` must return 401. Requests made with no configured Blue key return 503.
4. Configure `BLUE_BASE_URL` and `BLUE_API_KEY` securely for the CLI. Run `npm run blue -- scan`, then `npm run blue -- quote <actual-ticker>`. Verify a live anonymous Kalshi request succeeds, market identity matches, terms are present, and book depth is returned.
5. Have Blue publish an actual sourced **watch** or **pass** brief first. Verify it appears on the dashboard and persists after another request/deployment. Replaying the same request must return `replayed: true` without another entry.
6. Run `npm run blue -- sync`, continuing every opaque `nextCursor`. Inspect `errors` and `complete`; a 200 response alone does not establish successful reconciliation.
7. Only then enable scheduled research and discretionary paper trades. There is no need to place a test trade in the production record merely to complete deployment.

## 4. Add only the requested subdomain

In this project's Vercel domain settings, add `kalshi.mattvildibill.com`. Inspect the exact DNS record Vercel requests. Add only that new subdomain's required record through its DNS provider. Do not replace root-domain nameservers, change the apex record, move the main website, or claim domain verification until Vercel reports success.

Check HTTPS and application health through the final subdomain. If the record already exists for another resource, stop and report the conflict rather than repointing it automatically.

## 5. Connect Blue

Give Blue the repository's [`docs/BLUE.md`](BLUE.md) instructions and access to the shared API key through its existing secure tools. The CLI works from any Node.js environment with the repository available; ordinary HTTPS requests are also supported.

Blue owns the schedule. Each job should synchronize, scan a bounded market set, research selectively, publish decisions, optionally request eligible paper trades, synchronize again, and report failures and coverage. No background agent/model runtime is hosted by this site.

A successful manual API call does not prove a scheduled Dot run has the same secrets/tools. Verify one manual review and one scheduled review independently. Avoid overlapping jobs; idempotency and database atomicity are safeguards, not a reason to run duplicate reviews.

## Managed cloud network requirements

Dependency installation uses the existing package-manager allowance. Live checks need `external-api.kalshi.com`; documentation uses `docs.kalshi.com`. The dedicated Supabase project's exact `<project-ref>.supabase.co` hostname must be allowed after it is known. GitHub API and Vercel access need their respective configured connections and domains. A saved environment draft does not apply network changes or deploy the application.
