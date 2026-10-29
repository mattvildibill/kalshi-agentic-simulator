import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireBlue, parseBody, response, failure } from "@/lib/http";
import { updateSnapshot } from "@/lib/storage";
import { resetRun } from "@/lib/runs";
export const runtime = "nodejs";
const schema = z
  .object({
    idempotencyKey: z.string().min(8).max(200),
    expectedRunId: z.string().min(1).max(100),
    reason: z.string().min(1).max(500),
  })
  .strict();
export async function POST(request: Request) {
  try {
    requireBlue(request);
    const input = await parseBody(request, schema);
    const nextId = `run_${randomUUID()}`;
    const now = new Date().toISOString();
    const result = await updateSnapshot((snapshot) =>
      resetRun(snapshot, input, nextId, now),
    );
    return response(result, result.replayed ? 200 : 201);
  } catch (error) {
    return failure(error);
  }
}
