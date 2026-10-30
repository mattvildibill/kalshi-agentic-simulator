import type { DashboardData, DashboardPosition } from "@/lib/dashboard-types";
import { positionValue } from "@/lib/dashboard-display";
import { PositionResultDate } from "./position-timing";
import { date, Icon, money, signedMoney } from "./dashboard-ui";

export function PositionTable({
  positions,
  data,
  onSelect,
}: {
  positions: DashboardPosition[];
  data: DashboardData;
  onSelect: (position: DashboardPosition) => void;
}) {
  const settled = positions[0]?.status === "settled";
  return (
    <table className="positions-table">
      <caption className="sr-only">
        Recorded paper {settled ? "settlements" : "positions"}; each row is one
        fill. Open values use timestamped bids.
      </caption>
      <thead>
        <tr>
          <th scope="col">Market / {settled ? "result" : "position"}</th>
          <th scope="col">
            {settled ? "Entry → settlement" : "Entry → last bid"}
          </th>
          <th scope="col">Amount invested</th>
          <th scope="col">{settled ? "Net profit / loss" : "Open profit"}</th>
          <th scope="col">
            {settled ? "Recorded settlement" : "Expected result"}
          </th>
        </tr>
      </thead>
      <tbody>
        {positions.map((p) => {
          const value = positionValue(p);
          const profit = settled
            ? p.profitCents
            : value === null
              ? null
              : value - p.costCents;
          const research = data.research.find(
            (r) =>
              r.id === p.researchId &&
              r.ticker === p.ticker &&
              r.side === p.side,
          );
          const outcome =
            p.settlementResult === "scalar"
              ? "Scalar"
              : p.settlementResult
                ? p.settlementResult === p.side
                  ? "Won"
                  : "Lost"
                : "Settled";
          return (
            <tr key={p.id}>
              <td className="position-market-cell">
                <button
                  type="button"
                  className="market-title"
                  onClick={() => onSelect(p)}
                  aria-haspopup="dialog"
                >
                  {p.title}
                  <Icon name="arrow" />
                </button>
                <div className="market-subline">
                  <span className={`side-badge ${p.side}`}>{p.side}</span>
                  <span>
                    {settled ? outcome : research?.category || "Uncategorized"}
                  </span>
                  <span>{p.quantity.toLocaleString("en-US")} contracts</span>
                </div>
              </td>
              <td className="position-price-cell" data-label="Entry → last bid">
                <span className="price-shift">
                  {p.priceCents}¢ <span>→</span>{" "}
                  <strong>
                    {settled
                      ? p.payoutCents === null || !p.quantity
                        ? "—"
                        : `${Math.round(p.payoutCents / p.quantity)}¢`
                      : value === null
                        ? "—"
                        : `${p.markPriceCents}¢`}
                  </strong>
                </span>
                <span className="cell-note">
                  {settled
                    ? "Final payout / contract"
                    : value === null
                      ? "Bid not recorded"
                      : date(p.markAsOf, true)}
                </span>
              </td>
              <td className="position-cost-cell" data-label="Invested">
                {money(p.costCents)}
                <span className="cell-note">Fees included</span>
              </td>
              <td
                className="position-profit-cell"
                data-label={settled ? "Net profit" : "Open profit"}
              >
                <span
                  className={
                    profit === null
                      ? "muted"
                      : profit > 0
                        ? "positive"
                        : profit < 0
                          ? "negative"
                          : ""
                  }
                >
                  {profit === null ? "—" : signedMoney(profit)}
                </span>
                <span className="cell-note">
                  {profit === null
                    ? "Mark unavailable"
                    : p.costCents
                      ? `${profit > 0 ? "+" : ""}${((profit / p.costCents) * 100).toFixed(1)}%`
                      : "No cost recorded"}
                </span>
              </td>
              <td
                className="position-result-cell"
                data-label={settled ? "Settled" : "Expected result"}
              >
                <PositionResultDate
                  position={p}
                  demo={data.mode === "demo"}
                  runId={data.run?.id}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
