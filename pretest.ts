import { BROWSERS } from "./config.js";
import { buildRunReady } from "./utils.js";

await Promise.allSettled(BROWSERS.map(buildRunReady));

console.log("Pretest setup complete. Starting tests...");
