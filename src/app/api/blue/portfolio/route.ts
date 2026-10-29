import { GET as portfolio } from "../../portfolio/route";
import { failure, requireBlue } from "@/lib/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    requireBlue(request);
    return await portfolio();
  } catch (error) {
    return failure(error);
  }
}
