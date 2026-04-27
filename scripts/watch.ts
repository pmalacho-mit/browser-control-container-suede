#!/usr/bin/env -S npx tsx
// scripts/watch.ts  –  Background logger (console + JS errors + network)
//
// Usage:
//   ./scripts/watch.ts                   # attach to first tab, log to LOG_DIR
//   ./scripts/watch.ts --target <index>  # attach to a specific tab (default: first open tab)
//
// Logs are written as JSONL to:
//   $LOG_DIR/<date>/<target-index>.jsonl

import { connect, getPage, printHelp } from "./lib.ts";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Request, Browser } from "playwright";

if (process.argv.includes("--help")) printHelp(import.meta.url);

const args = process.argv.slice(2);
const LOG_DIR = process.env.LOG_DIR || "/tmp/browser-logs";

let browser: Browser;
try {
  browser = await connect();
  const page = await getPage(browser, args);

  const tIdx = args.indexOf("--target");
  const target = tIdx !== -1 ? args[tIdx + 1] : "0";

  const dateStr = new Date().toISOString().slice(0, 10);
  const logDir = join(LOG_DIR, dateStr);
  mkdirSync(logDir, { recursive: true });
  const logFile = join(logDir, `${target}.jsonl`);

  const log = (entry: Record<string, unknown>) => {
    const line = JSON.stringify({ ts: Date.now(), ...entry });
    appendFileSync(logFile, line + "\n");
    console.log(line);
  };

  let reqCounter = 0;
  const reqIds = new WeakMap<Request, number>();

  page.on("console", (msg) => {
    log({ kind: "console", level: msg.type(), text: msg.text() });
  });

  page.on("pageerror", (err) => {
    log({ kind: "error", message: err.message });
  });

  page.on("request", (req) => {
    const id = ++reqCounter;
    reqIds.set(req, id);
    log({ kind: "net:request", id, method: req.method(), url: req.url() });
  });

  page.on("response", (res) => {
    const id = reqIds.get(res.request()) ?? res.url();
    log({
      kind: "net:response",
      id,
      status: res.status(),
      mime: res.headers()["content-type"] ?? "",
      url: res.url(),
    });
  });

  page.on("requestfailed", (req) => {
    const id = reqIds.get(req) ?? req.url();
    log({
      kind: "net:failed",
      id,
      error: req.failure()?.errorText ?? "unknown",
    });
  });

  console.error(`\n✔ Watching tab ${target}`);
  console.error(`  Log file: ${logFile}`);
  console.error("  Press Ctrl+C to stop.\n");

  process.on("SIGINT", async () => {
    console.error("\nStopping watcher.");
    await browser?.close().catch(() => {});
    process.exit(0);
  });

  await new Promise(() => {});
} catch (err) {
  console.error("watch failed:", (err as Error).message);
  process.exit(1);
}
