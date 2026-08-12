import { container } from "./browser-control-container-suede.programmatic-docker-suede";
import { browsers } from "./release";
import defaults from "./release/defaults";

await Promise.allSettled(
  browsers.map(defaults.container).map((browser) => container.tryRemove(browser)),
);

console.log("Posttest cleanup complete.");
