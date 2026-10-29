import { response, failure } from "@/lib/http";
import { readSnapshot } from "@/lib/storage";
export const runtime = "nodejs";
export async function GET() {
  try {
    const snapshot = await readSnapshot();
    return response({
      transactions: snapshot.ledger.transactions,
      settlements: snapshot.ledger.settlements,
      trades: snapshot.ledger.trades.map(
        ({ requestFingerprint: _f, idempotencyKey: _k, ...trade }) => trade,
      ),
      lastSyncAt: snapshot.lastSyncAt,
      lastSyncErrors: snapshot.lastSyncErrors,
      marks: snapshot.marks,
    });
  } catch (error) {
    return failure(error);
  }
}
