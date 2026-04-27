#!/usr/bin/env -S npx tsx
// scripts/start.ts  –  Launch the background browser server
//
// Usage:
//   ./scripts/start.ts          # start chromium (default)
//   BROWSER=firefox ./scripts/start.ts

import { spawn } from "node:child_process";
import { existsSync, readFileSync, mkdirSync, openSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { printHelp } from "./lib.ts";

if (process.argv.includes("--help")) printHelp(import.meta.url);

const __dirname = dirname(fileURLToPath(import.meta.url));
const WS_FILE = process.env.WS_FILE || "/tmp/playwright-ws";
const LOG_DIR = process.env.LOG_DIR || "/tmp/browser-logs";

mkdirSync(LOG_DIR, { recursive: true });

if (existsSync(WS_FILE)) {
  console.error(
    `Server already running. wsEndpoint: ${readFileSync(WS_FILE, "utf-8").trim()}`,
  );
  console.error("Run ./scripts/stop.ts first to restart.");
  process.exit(1);
}

const serverLog = join(LOG_DIR, "server.log");
const logFd = openSync(serverLog, "a");

const child = spawn(
  process.execPath,
  ["--import", "tsx", join(__dirname, "server.ts")],
  {
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: process.env,
    cwd: join(__dirname, ".."),
  },
);
child.unref();

// Poll for the ws-endpoint file to appear
const deadline = Date.now() + 30_000;
while (Date.now() < deadline) {
  if (existsSync(WS_FILE)) {
    const ws = readFileSync(WS_FILE, "utf-8").trim();
    if (ws) {
      console.log(`✔ ${process.env.BROWSER || "chromium"} ready`);
      console.log(`  wsEndpoint: ${ws}`);
      process.exit(0);
    }
  }
  await new Promise((r) => setTimeout(r, 200));
}
console.error("✘ Server didn't start within 30s");
try {
  console.error(readFileSync(serverLog, "utf-8"));
} catch { /* no log yet */ }
process.exit(1);
