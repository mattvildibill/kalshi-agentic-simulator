import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { failure, requireBlue, response } from "@/lib/http";
import { RESEARCH_POLICY_VERSION } from "@/lib/research-policy";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    requireBlue(request);
    const [playbook, strategy] = await Promise.all([
      readFile(path.join(process.cwd(), "docs", "BLUE.md"), "utf8"),
      readFile(path.join(process.cwd(), "docs", "STRATEGY.md"), "utf8"),
    ]);
    return response({
      version: RESEARCH_POLICY_VERSION,
      sha256: createHash("sha256")
        .update(JSON.stringify({ playbook, strategy }))
        .digest("hex"),
      playbook,
      strategy,
    });
  } catch (error) {
    return failure(error);
  }
}
