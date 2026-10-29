#!/usr/bin/env node
import { readFile } from "node:fs/promises";
const [command = "status", argument] = process.argv.slice(2);
const base = process.env.BLUE_BASE_URL || "http://localhost:3000";
const url = new URL(base);
if (
  url.username ||
  url.password ||
  (url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    ))
) {
  console.error(
    "BLUE_BASE_URL must use HTTPS (HTTP permitted only for local development).",
  );
  process.exit(1);
}
const paths = {
  status: "/api/portfolio",
  scan: "/api/markets",
  research: "/api/research",
  trade: "/api/trades",
  sync: "/api/sync",
  health: "/api/health",
  ledger: "/api/ledger",
  quote: "/api/markets/",
};
if (!Object.hasOwn(paths, command)) {
  console.error(
    "Usage: npm run blue -- status|scan [cursor]|quote <ticker>|research <json-file>|trade <json-file>|sync [cursor]|health|ledger",
  );
  process.exit(1);
}
let endpoint = new URL(paths[command], url);
if (command === "quote") {
  if (!argument || !/^[A-Za-z0-9_.-]{1,200}$/.test(argument)) {
    console.error("quote requires a valid ticker");
    process.exit(1);
  }
  endpoint = new URL(paths.quote + encodeURIComponent(argument), url);
}
if (["scan", "sync"].includes(command) && argument)
  endpoint.searchParams.set("cursor", argument);
const privateCommand = !["status", "health", "ledger"].includes(command);
if (privateCommand && !process.env.BLUE_API_KEY) {
  console.error("Set BLUE_API_KEY securely in this process environment.");
  process.exit(1);
}
const headers = { Accept: "application/json" };
if (privateCommand)
  headers.Authorization = `Bearer ${process.env.BLUE_API_KEY}`;
const options = {
  headers,
  redirect: "error",
  signal: AbortSignal.timeout(65_000),
};
if (["research", "trade"].includes(command)) {
  if (!argument) {
    console.error(`${command} requires a JSON file`);
    process.exit(1);
  }
  options.body = await readFile(argument, "utf8");
  JSON.parse(options.body);
  options.method = "POST";
  headers["Content-Type"] = "application/json";
} else if (command === "sync") options.method = "POST";
try {
  const response = await fetch(endpoint, options);
  const body = await response.json();
  console.log(JSON.stringify(body, null, 2));
  if (!response.ok) process.exitCode = 1;
} catch {
  console.error(
    "Request failed. Check connectivity; retry writes with the SAME idempotency key.",
  );
  process.exitCode = 1;
}
