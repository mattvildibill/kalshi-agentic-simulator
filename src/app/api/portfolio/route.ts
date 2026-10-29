import { getDashboard } from "@/lib/dashboard-data";
import { response } from "@/lib/http";
export const runtime = "nodejs";
export async function GET() {
  const data = await getDashboard();
  return response(
    data,
    data.mode === "unavailable" || data.mode === "unconfigured" ? 503 : 200,
  );
}
