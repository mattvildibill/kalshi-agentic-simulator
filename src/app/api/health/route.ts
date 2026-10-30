import { RISK_POLICY } from "@/lib/engine";
import { response } from "@/lib/http";
import { readSnapshot, storageMode } from "@/lib/storage";
export const runtime = "nodejs";
export async function GET() {
  const storage = storageMode();
  let database = false;
  if (storage !== "unconfigured") {
    try {
      await readSnapshot();
      database = true;
    } catch {
      /* Report unavailable without credentials. */
    }
  }
  const blueConfigured = (process.env.BLUE_API_KEY?.length || 0) >= 32;
  return response(
    {
      status: database && blueConfigured ? "ready" : "setup_required",
      paperOnly: true,
      riskPolicy: RISK_POLICY,
      storage,
      database,
      blueConfigured,
    },
    database && blueConfigured ? 200 : 503,
  );
}
