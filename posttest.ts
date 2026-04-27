import { browsers, tryRemove } from "./release";

await Promise.allSettled(
  browsers.map((browser) => tryRemove(browser, { log: true })),
);

console.log("Posttest cleanup complete.");
