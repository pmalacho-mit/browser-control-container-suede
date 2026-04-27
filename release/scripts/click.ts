#!/usr/bin/env -S npx tsx
// scripts/click.ts  –  Click an element
//
// Usage:
//   ./scripts/click.ts 'button.submit'                  # CSS selector (auto-waits, scrolls into view)
//   ./scripts/click.ts --xy 500,300                     # raw coordinates
//   ./scripts/click.ts 'a[href="/login"]' --wait 2      # click then wait 2s
//   ./scripts/click.ts 'button.submit' --target <id>    # click in a specific tab (default: first open tab)

import { connect, arg, getPage, getHelp, printHelp } from "./lib.ts";

if (process.argv.includes("--help")) printHelp(import.meta.url);

const parseXY = (xy: string): [number, number] => {
  const [x, y] = xy.split(",").map((p) => Number(p));
  if (!Number.isFinite(x) || !Number.isFinite(y))
    throw new Error("--xy must be in the form x,y with numeric values");
  return [x, y];
};

const args = process.argv.slice(2);
const xy = arg(args, "--xy");
const waitSec = Number(arg(args, "--wait") ?? 0);
const selector = args.find((a) => !a.startsWith("--"));

if (!Number.isFinite(waitSec) || waitSec < 0) {
  console.error("--wait must be a non-negative number");
  console.log(getHelp(import.meta.url));
  process.exit(1);
}

if (!selector && !xy) {
  console.error("Usage: click.ts '<css-selector>' | click.ts --xy x,y");
  console.log(getHelp(import.meta.url));
  process.exit(1);
}

let browser;
try {
  browser = await connect();
  const page = await getPage(browser, args);

  if (xy) {
    const [x, y] = parseXY(xy);
    await page.mouse.click(x, y);
    console.log(`✔ Clicked at (${Math.round(x)}, ${Math.round(y)})`);
  } else {
    const locator = page.locator(selector!).first();
    const info = await locator.evaluate(({ tagName, textContent }) => ({
      tag: tagName,
      text: textContent?.trim().slice(0, 80) ?? "",
    }));
    console.log(`Target: <${info.tag.toLowerCase()}> "${info.text}"`);
    await locator.click();
    console.log(`✔ Clicked ${selector}`);
  }

  if (waitSec > 0) await page.waitForTimeout(waitSec * 1000);
} catch (err) {
  console.error("click failed:", err);
  process.exit(1);
} finally {
  await browser?.close().catch(() => {});
}
