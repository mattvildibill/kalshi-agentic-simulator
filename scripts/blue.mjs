#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { connection, client, verify } from "./blue-client.mjs";

const args = process.argv.slice(2);
const local = args[0] === "--local";
if (local) args.shift();
const [command = "status", argument] = args;
const paths = {
  instructions: "/api/blue/instructions",
  status: "/api/blue/portfolio",
  scan: "/api/markets",
  research: "/api/research",
  reset: "/api/runs/reset",
  runs: "/api/runs",
  archive: "/api/runs/",
  trade: "/api/trades",
  sync: "/api/sync",
  health: "/api/health",
  ledger: "/api/ledger",
  quote: "/api/markets/",
};
let config;
try {
  config = connection(process.env, local);
  let result;
  if (command === "verify") {
    result = await verify(config);
  } else {
    if (!Object.hasOwn(paths, command))
      throw new Error(
        "Usage: npm run blue -- instructions|verify|status|scan [cursor]|quote <ticker>|research <json-file>|trade <json-file>|reset <json-file>|runs|archive <run-id>|sync [cursor]|health|ledger",
      );
    let path = paths[command];
    if (["quote", "archive"].includes(command)) {
      if (!argument || !/^[A-Za-z0-9_.-]{1,200}$/.test(argument))
        throw new Error("quote/archive requires a valid identifier");
      path += encodeURIComponent(argument);
    }
    if (["scan", "sync"].includes(command) && argument)
      path += `?${new URLSearchParams({ cursor: argument })}`;
    const options = { authenticated: !["health", "ledger"].includes(command) };
    if (["research", "trade", "reset"].includes(command)) {
      if (!argument) throw new Error(`${command} requires a JSON file`);
      try {
        options.body = await readFile(argument, "utf8");
        JSON.parse(options.body);
      } catch {
        throw new Error("Could not read a valid JSON payload file.");
      }
      options.method = "POST";
    } else if (command === "sync") options.method = "POST";
    result = await client(config)(path, options);
    if (
      command === "sync" &&
      (!Array.isArray(result.errors) ||
        result.errors.length ||
        (result.complete !== true && !result.nextCursor))
    )
      process.exitCode = 1;
  }
  const output = JSON.stringify(result, null, 2);
  console.log(
    config.key ? output.replaceAll(config.key, "[REDACTED]") : output,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : "Command failed.";
  console.error(
    config?.key ? message.replaceAll(config.key, "[REDACTED]") : message,
  );
  process.exitCode = 1;
}
