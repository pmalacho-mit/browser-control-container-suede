#!/usr/bin/env -S npx tsx
// scripts/wait.ts  –  Wait for conditions
//
// Usage:
//   ./scripts/wait.ts 'div.loaded'                  # wait for selector (30s default)
//   ./scripts/wait.ts 'div.loaded' --timeout 10     # custom timeout (seconds)
//   ./scripts/wait.ts --idle                         # wait for network idle
//   ./scripts/wait.ts --load                         # wait for load event
//   ./scripts/wait.ts 'div.loaded' --target <index>  # wait in a specific tab (default: first open tab)

import { connect, getPage, printHelp } from "./lib.ts";

if (process.argv.includes("--help")) printHelp(import.meta.url);

const parsePositiveFloat = (name: string, value: string | undefined): number => {
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed) || parsed <= 0)
    throw new Error(`${name} must be a positive number`);
  return parsed;
};

const args = process.argv.slice(2);
const selector = args.find((a) => !a.startsWith("--"));
const waitIdle = args.includes("--idle");
const waitLoad = args.includes("--load");
const tIdx = args.indexOf("--timeout");
const timeoutSec =
  tIdx !== -1 ? parsePositiveFloat("--timeout", args[tIdx + 1]) : 30;

if (!selector && !waitIdle && !waitLoad) {
  console.error(
    "Usage: wait.ts '<selector>' | wait.ts --idle | wait.ts --load",
  );
  process.exit(1);
}

let browser;
try {
  browser = await connect();
  const page = await getPage(browser, args);
  const timeout = timeoutSec * 1000;

  if (waitLoad) {
    await page.waitForLoadState("load", { timeout });
    console.log("✔ Page load event fired");
  } else if (waitIdle) {
    await page.waitForLoadState("networkidle", { timeout });
    console.log("✔ Network idle");
  } else {
    await page.waitForSelector(selector!, { timeout });
    console.log(`✔ Found: ${selector}`);
  }
} catch (err) {
  console.error("wait failed:", (err as Error).message);
  process.exit(1);
} finally {
  await browser?.close().catch(() => {});
}
