<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project boundaries

- Work only on `mattvildibill/kalshi-agentic-simulator`, its dedicated Vercel/Supabase projects, and `kalshi.mattvildibill.com`. Do not modify the main website or unrelated resources.
- This is paper trading only. Never add real Kalshi order placement or require Kalshi credentials.
- No paid model API, paid infrastructure, or trial-dependent features. Blue is the research coordinator.
- Use the existing checkout. Cloud tasks are already isolated; do not create worktrees unless explicitly requested.
- Read `README.md`, `docs/BLUE.md`, and `docs/DEPLOYMENT.md` before integration work.
- Keep secrets server-side and out of source, logs, screenshots, and chat. Never prefix a secret with `NEXT_PUBLIC_`.
- Money is integer cents. Research probabilities refer to the selected side. Database mutations must remain atomic and idempotent.
- Never fabricate production research, fills, prices, or settlements. `/demo` is explicitly fictional and never writes to the portfolio.
- Run `npm test`, `npm run typecheck`, and `npm run build` for backend changes. Run `npm run test:e2e` for dashboard interactions.
