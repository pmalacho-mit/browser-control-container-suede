#!/usr/bin/env -S npx tsx
// scripts/screenshot.ts  –  Capture a screenshot
//
// Usage:
//   ./scripts/screenshot.ts                          # viewport PNG to stdout path
//   ./scripts/screenshot.ts --full                   # full-page screenshot
//   ./scripts/screenshot.ts -o /tmp/shot.png         # custom output path
//   ./scripts/screenshot.ts --format jpeg --quality 80
//   ./scripts/screenshot.ts --target <index>         # capture a specific tab (default: first open tab)

import { connect, arg, getPage, printHelp } from "./lib.ts";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

if (process.argv.includes("--help")) printHelp(import.meta.url);

const parseFormat = (value: string | undefined): "png" | "jpeg" | "webp" => {
  const format = (value ?? "png") as "png" | "jpeg" | "webp";
  if (format !== "png" && format !== "jpeg" && format !== "webp")
    throw new Error("--format must be one of: png, jpeg, webp");
  return format;
};

const parseQuality = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  const quality = Number.parseInt(value, 10);
  if (!Number.isFinite(quality) || quality < 0 || quality > 100)
    throw new Error("--quality must be an integer between 0 and 100");
  return quality;
};

const args = process.argv.slice(2);
const fullPage = args.includes("--full");

const fmtIdx = args.indexOf("--format");
const format = parseFormat(fmtIdx !== -1 ? args[fmtIdx + 1] : undefined);

const qIdx = args.indexOf("--quality");
const quality = parseQuality(qIdx !== -1 ? args[qIdx + 1] : undefined);

const oIdx = args.indexOf("-o");
let outPath = oIdx !== -1 ? args[oIdx + 1] : null;

let browser;
try {
  browser = await connect();
  const page = await getPage(browser, args);

  if (!outPath) {
    const dir = join(process.env.LOG_DIR || "/tmp/browser-logs", "screenshots");
    mkdirSync(dir, { recursive: true });
    outPath = join(dir, `screenshot-${Date.now()}.${format}`);
  }

  mkdirSync(dirname(outPath), { recursive: true });

  await page.screenshot({
    path: outPath,
    fullPage,
    type: format,
    ...(quality !== undefined ? { quality } : {}),
  });

  console.log(outPath);
} catch (err) {
  console.error("Screenshot failed:", (err as Error).message);
  process.exit(1);
} finally {
  await browser?.close().catch(() => {});
}
