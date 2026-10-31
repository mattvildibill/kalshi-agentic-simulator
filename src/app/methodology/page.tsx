import Link from "next/link";
export const metadata = { title: "Research methodology" };
export default function Methodology() {
  return (
    <main
      className="methodology-page"
      style={{
        maxWidth: 850,
        margin: "0 auto",
        padding: "64px 24px",
        lineHeight: 1.8,
      }}
    >
      <Link href="/">← Back to Blue</Link>
      <h1>How it works</h1>
      <p>
        This project tracks Blue’s research and simulated Kalshi trades. It
        starts with $100,000 in paper cash. It is not affiliated with Kalshi,
        does not send orders to Kalshi, and requires no Kalshi account.
      </p>
      <h2>How a decision is made</h2>
      <p>
        Blue scans public market data, selects researchable questions, gathers
        primary evidence, and asks a challenger to look for errors and contrary
        evidence. Each published brief includes the selected side’s probability,
        an uncertainty range, sources, exact resolution criteria, and a trade,
        watch, or pass decision. Agreement among agents is not independent
        verification.
      </p>
      <h2>How a paper trade is recorded</h2>
      <p>
        A newer watch, pass, or revised forecast supersedes an earlier trade
        recommendation for the same market and side. New fills must use the
        latest published decision; accepted fills and their original research
        remain unchanged.
      </p>
      <p>
        The server fetches the market and order book. It supports standard $1
        binary contracts and whole-contract quantities. A purchase uses the best
        available ask derived from the opposing bid, rounded up to a cent, plus
        1¢ per contract of modeled slippage. The observed depth must cover the
        entire purchase. This is a simulation assumption, not evidence that a
        real order would fill.
      </p>
      <p>
        Estimated fees are rounded up from 0.07 × quantity × price × (1 −
        price), with price in dollars. This is a disclosed model, not a verified
        fee for every Kalshi series. Quote snapshots, research, modeled fees,
        and execution prices are retained.
      </p>
      <h2>Limits and uncertainty</h2>
      <p>
        Quotes expire after 60 seconds. Research and its evidence timestamp
        expire for trading after 24 hours; fast-moving events may need much
        shorter windows, which Blue must assess. Total open cost in one market
        is limited to 10% of the initial bankroll ($10,000 on $100,000),
        including fees across all open fills and both sides. The same $10,000
        limit applies across markets in one Kalshi event. Blue must assess
        correlations across different events separately. A market accepts at
        most one new paper fill per 60 seconds, across both sides, to limit
        reuse of observed liquidity. The simulator cannot borrow. Positive
        expected value depends on the submitted probability; the software cannot
        establish that the forecast is correct.
      </p>
      <h2>Settlement and accounting</h2>
      <p>
        Only a finalized result from Kalshi can settle a position. Binary wins
        pay $1 per contract and losses pay $0. Explicit scalar payouts are
        supported when representable exactly in cents. Disputed, void,
        ambiguous, or unsupported outcomes remain unresolved for review. There
        is no early-exit trading in version one.
      </p>
      <p>
        The dashboard separates cash, open position cost, and realized profit.
        Portfolio value adds cash to open contracts valued at their selected
        side’s last recorded bid. Total profit includes unrealized changes and
        entry fees, and excludes future exit fees. If any open bid is missing,
        the portfolio total stays unavailable. Open cost is not market value.
        The performance chart uses settled profit only; historical portfolio
        valuations are not inferred. Price observations and finalized
        settlements update automatically while the dashboard is open. A
        completed event may still await Kalshi’s official finalized result
        before the portfolio records a payout.
      </p>
      <h2>Reviewing results</h2>
      <p>
        Blue pursues positive expected paper profit over a 180-day experiment.
        Research records state a reasoned central probability and evidence-based
        stress scenarios. Subjective estimates without validated models are
        allowed. Uncertainty generally reduces size rather than vetoing a
        purchase. Contract rules, essential dated evidence, fresh executable
        quotes and independent challenge remain mandatory. No estimate
        guarantees a profitable outcome.
      </p>
      <p>
        Central-EV positions normally start at $1,000 with a $2,500 cumulative
        thesis ceiling. Learning bets normally start at $500 with a $1,000
        thesis ceiling and explicitly disclose uncertain true edge. Both require
        positive central expected value after fees and slippage; negative
        low-case value is allowed. Positive central value does not establish
        positive uncertainty-adjusted value. There is no spending quota.
      </p>
      <p>
        Policy 2026-10-31.1 retires the old lifetime pilot for future purchases;
        historical classifications and costs remain intact. Limits including
        fees are $25,000 total open cost, $10,000 per correlated theme, $7,500
        per method, $10,000 open learning exposure and $10,000 new purchases per
        rolling 24 hours. Legacy holdings count. Active-run realized losses of
        $10,000, a $10,000 decline from the realized profit high-water mark, or
        $2,500 realized losses within one method pause new purchases in the
        affected scope pending review and a user decision. Open positions remain
        held to settlement.
      </p>
      <p>
        These are Blue operating controls checked against the ledger, not
        additional backend guarantees. The engine independently enforces
        positive central expected value, fresh quotes and its 10% market/event
        caps. Reviews occur every 20 newly resolved questions or 30 days; small
        samples do not prove skill.
      </p>
      <p>
        Profit alone is noisy. Evaluate forecasts for researched trades, watches
        and passes, along with calibration, correlated exposure and later price
        observations when available. Include archived lessons while keeping run
        balances separate. These evaluations currently require manual research;
        automatic watch/pass scoring and later-price collection are not built
        into the app. Keep original forecasts intact and publish new dated
        briefs when evidence changes. Small samples do not establish forecasting
        skill.
      </p>
      <p>
        <Link href="/demo">View demo →</Link>
      </p>
      <p>
        The dashboard checks held markets about every minute while visible, on
        page load, and when returning to a tab whose last check was at least a
        minute ago. Refresh checks on demand, sharing the same one-minute limit
        across visitors. Each check handles up to 10 markets; larger portfolios
        continue on later checks. It records official bids and supported
        finalized payouts without a Blue review. New research and paper
        purchases still require Blue. Failed updates remain visible.
      </p>
    </main>
  );
}
