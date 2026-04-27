#!/usr/bin/env -S npx tsx
// scripts/type.ts  –  Type text into an input field
//
// Usage:
//   ./scripts/type.ts 'input[name="email"]' 'user@example.com'
//   ./scripts/type.ts '#search' 'hello' --clear --enter
//   ./scripts/type.ts '#search' 'hello' --target <index>  # target a specific tab
//
// --clear  empties the field before typing.
// --enter  presses Enter after typing.

import { connect, getPage, printHelp } from "./lib.ts";

if (process.argv.includes("--help")) printHelp(import.meta.url);

const args = process.argv.slice(2);
const skipIdx = new Set(
  ["--target"].map((f) => args.indexOf(f) + 1).filter((i) => i > 0),
);
const positional = args.filter((a, i) => !a.startsWith("--") && !skipIdx.has(i));
const selector = positional[0];
const text = positional[1];
const clearFirst = args.includes("--clear");
const pressEnter = args.includes("--enter");

if (!selector || text === undefined) {
  console.error("Usage: type.ts '<css-selector>' '<text>' [--clear] [--enter]");
  process.exit(1);
}

let browser;
try {
  browser = await connect();
  const page = await getPage(browser, args);
  const locator = page.locator(selector).first();

  const tag = await locator.evaluate((el) => el.tagName.toLowerCase());
  const type = await locator.evaluate(
    (el) => (el as HTMLInputElement).type || "",
  );
  console.log(`Focused: <${tag} type="${type}">`);

  if (clearFirst) await locator.fill("");

  await locator.pressSequentially(text, { delay: 20 });
  console.log(`✔ Typed ${text.length} characters`);

  if (pressEnter) {
    await page.keyboard.press("Enter");
    console.log("✔ Pressed Enter");
  }
} catch (err) {
  console.error("type failed:", (err as Error).message);
  process.exit(1);
} finally {
  await browser?.close().catch(() => {});
}
