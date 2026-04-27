import { browsers, buildAndRun } from "./release/index.js";

await Promise.allSettled(
  browsers.map((browser) => buildAndRun(browser, { log: true })),
);

console.log("Pretest setup complete. Starting tests...");
