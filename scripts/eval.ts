#!/usr/bin/env -S npx tsx
// scripts/eval.ts  –  Evaluate JavaScript in the active tab
//
// Usage:
//   ./scripts/eval.ts 'document.title'
//   ./scripts/eval.ts 'document.querySelectorAll("a").length'
//   ./scripts/eval.ts 'await fetch("/api/status").then(r => r.json())'
//   echo 'complex_script()' | ./scripts/eval.ts --stdin
//   ./scripts/eval.ts --target <id> 'expression'   # evaluate in a specific tab (default: first open tab)
//
// Runs in an async context so `await` is supported.

import { connect, getPage, printHelp } from "./lib.ts";

if (process.argv.includes("--help")) printHelp(import.meta.url);

const args = process.argv.slice(2);
let expression: string;

if (args.includes("--stdin")) {
  // Read expression from stdin (useful for complex scripts)
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  expression = Buffer.concat(chunks).toString("utf-8").trim();
} else {
  // Skip --target's value when collecting positional args
  const skipIdx = new Set(
    ["--target"].map((f) => args.indexOf(f) + 1).filter((i) => i > 0),
  );
  expression = args
    .filter((a, i) => !a.startsWith("--") && !skipIdx.has(i))
    .join(" ");
}

if (!expression) {
  console.error("Usage: eval.ts '<expression>' | eval.ts --stdin");
  process.exit(1);
}

let browser;
try {
  browser = await connect();
  const page = await getPage(browser, args);

  // Wrap in an async IIFE so `await` works at the top level of the expression.
  // page.evaluate(string) auto-awaits the resulting Promise.
  const wrapped = `(async () => { return (${expression}); })()`;
  const val = await page.evaluate(wrapped);

  // Pretty-print objects, raw-print primitives, swallow undefined.
  if (typeof val === "object" && val !== null)
    console.log(JSON.stringify(val, null, 2));
  else if (val !== undefined) console.log(val);
} catch (err) {
  console.error("eval failed:", err);
  process.exit(1);
} finally {
  await browser?.close().catch(() => {});
}
