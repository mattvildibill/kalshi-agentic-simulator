import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { EngineError } from "./engine";
import { MarketDataError } from "./kalshi";
import { StorageError } from "./storage";
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function requireBlue(request: Request) {
  const expected = process.env.BLUE_API_KEY;
  if (!expected || expected.length < 32)
    throw new HttpError(
      503,
      "BLUE_NOT_CONFIGURED",
      "Blue access has not been configured.",
    );
  const header = request.headers.get("authorization") || "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    throw new HttpError(
      401,
      "UNAUTHORIZED",
      "An authorized Blue connection is required.",
    );
}
export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new HttpError(415, "JSON_REQUIRED", "Send application/json.");
  const reader = request.body?.getReader();
  if (!reader)
    throw new HttpError(400, "BODY_REQUIRED", "A JSON body is required.");
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65_536) {
        await reader.cancel();
        throw new HttpError(413, "BODY_TOO_LARGE", "Request exceeds 64 KiB.");
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let json: unknown;
  try {
    json = JSON.parse(Buffer.concat(parts).toString("utf8"));
  } catch {
    throw new HttpError(
      400,
      "INVALID_JSON",
      "Request must contain valid JSON.",
    );
  }
  const result = schema.safeParse(json);
  if (!result.success)
    throw new HttpError(
      422,
      "INVALID_INPUT",
      result.error.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; "),
    );
  return result.data;
}
export function response(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function failure(error: unknown) {
  if (error instanceof HttpError)
    return response(
      { error: { code: error.code, message: error.message } },
      error.status,
    );
  if (error instanceof EngineError)
    return response(
      { error: { code: error.code, message: error.message } },
      /CONFLICT/.test(error.code) ? 409 : 422,
    );
  if (error instanceof MarketDataError)
    return response(
      { error: { code: error.code, message: error.message } },
      /INVALID_TICKER|INVALID_CURSOR/.test(error.code) ? 422 : 502,
    );
  if (error instanceof StorageError)
    return response(
      { error: { code: error.code, message: error.message } },
      error.code === "WRITE_CONFLICT" ? 409 : 503,
    );
  // Never expose upstream responses, request bodies, database credentials, or stack traces.
  return response(
    {
      error: {
        code: "INTERNAL_ERROR",
        message:
          "The operation did not complete. Retry with the same idempotency key.",
      },
    },
    500,
  );
}
const text = z.string().trim().min(1).max(20_000);
const ticker = z.string().regex(/^[A-Za-z0-9_.-]{1,200}$/);
const key = z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/);
export const researchSchema = z
  .object({
    idempotencyKey: key,
    ticker,
    title: text,
    category: text.max(100),
    side: z.enum(["yes", "no"]),
    probability: z.number().min(0).max(1),
    probabilityLow: z.number().min(0).max(1),
    probabilityHigh: z.number().min(0).max(1),
    thesis: text,
    counterThesis: text,
    rationale: text,
    resolutionCriteria: text,
    evidenceAsOf: z.iso.datetime({ offset: true }),
    decision: z.enum(["trade", "watch", "pass"]),
    sources: z
      .array(
        z.object({ url: z.url().max(2000), title: text.max(500) }).strict(),
      )
      .min(1)
      .max(30),
  })
  .strict();
export const tradeSchema = z
  .object({
    idempotencyKey: key,
    researchId: z.string().min(1).max(200),
    ticker,
    side: z.enum(["yes", "no"]),
    quantity: z.number().int().min(1).max(100_000),
    maxPrice: z.number().int().min(1).max(100),
  })
  .strict();
