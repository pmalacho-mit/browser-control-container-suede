#!/usr/bin/env -S npx tsx
// scripts/nav.js  –  Navigate to a URL
//
// Usage:
//   ./scripts/nav.ts https://example.com          # navigate current tab
//   ./scripts/nav.ts https://example.com --new     # open in new tab
//   ./scripts/nav.ts https://example.com --wait 5  # extra wait (seconds) after load
//   ./scripts/nav.ts https://example.com --target <id>  # navigate a specific tab (default: first open tab)

import { connect, context, arg, getPage, getHelp, printHelp } from "./lib.ts";

if (process.argv.includes("--help")) printHelp(import.meta.url);

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith("--"));
const openNew = args.includes("--new");
const waitSec = Number(arg(args, "--wait") ?? 0);

if (!url) {
  console.error("Usage: nav.js <url> [--new] [--wait <s>]");
  console.log(getHelp(import.meta.url));
  process.exit(1);
}

let browser;
try {
  browser = await connect();
  const page = openNew
    ? await (await context(browser)).newPage()
    : await getPage(browser, args);
  await page.goto(url, { waitUntil: "load" });
  if (waitSec > 0) await page.waitForTimeout(waitSec * 1000);
  console.log(`✔ ${page.url()}`);
} catch (err) {
  console.error("Navigation failed:", err);
  process.exit(1);
} finally {
  await browser?.close().catch(() => {});
}
