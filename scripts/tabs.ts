#!/usr/bin/env -S npx tsx
// scripts/tabs.ts  –  Manage browser tabs
//
// Usage:
//   ./scripts/tabs.ts                      # list all tabs
//   ./scripts/tabs.ts --close <index>      # close a specific tab by index
//   ./scripts/tabs.ts --close-all          # close all tabs except the first

import { connect, allPages, printHelp } from "./lib.ts";

if (process.argv.includes("--help")) printHelp(import.meta.url);

const args = process.argv.slice(2);

let browser;
try {
  browser = await connect();
  const pages = allPages(browser);

  if (args.includes("--close-all")) {
    if (pages.length === 0) {
      console.log("No tabs to close.");
      process.exit(0);
    }
    for (let i = 1; i < pages.length; i++) {
      const title = await pages[i].title();
      await pages[i].close();
      console.log(`Closed: ${title || pages[i].url()}`);
    }
    const closed = Math.max(0, pages.length - 1);
    console.log(`\n${closed} tab(s) closed, ${pages.length > 0 ? 1 : 0} remaining.`);
  } else if (args.includes("--close")) {
    const idx = Number(args[args.indexOf("--close") + 1]);
    if (!Number.isFinite(idx) || idx < 0 || idx >= pages.length)
      throw new Error(`--close ${idx} out of range (have ${pages.length})`);
    await pages[idx].close();
    console.log(`Closed tab ${idx}`);
  } else {
    console.log(`${pages.length} tab(s):\n`);
    for (let i = 0; i < pages.length; i++) {
      const title = await pages[i].title();
      console.log(`  [${i}]`);
      console.log(`    Title: ${title || "(untitled)"}`);
      console.log(`    URL:   ${pages[i].url()}`);
      console.log();
    }
  }
} catch (err) {
  console.error("tabs failed:", (err as Error).message);
  process.exit(1);
} finally {
  await browser?.close().catch(() => {});
}
