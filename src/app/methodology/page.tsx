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
        valuations are not inferred. Price observations are updated when Blue
        runs a review; there is no continuous live feed. A settlement check
        happens only when Blue invokes synchronization, so displayed results may
        lag the exchange.
      </p>
      <h2>Reviewing results</h2>
      <p>
        Profit alone is noisy. Review probability calibration, research quality,
        correlated exposure, and how prices moved after a forecast. Keep
        original forecasts intact and publish new dated briefs when evidence
        changes. Small samples do not establish forecasting skill.
      </p>
      <p>
        <Link href="/demo">View demo →</Link>
      </p>
    </main>
  );
}
