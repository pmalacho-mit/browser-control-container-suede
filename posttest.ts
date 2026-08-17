import { container } from "./browser-control-container-suede.programmatic-docker-suede";
import { browsers } from "./release";
import defaults from "./release/defaults";

/**
 * The shared containers, plus the ones `forward.test.ts` gives itself because
 * what a container forwards is fixed when it starts. Those are removed in
 * `after` hooks, but a crashed or interrupted run leaves them behind, and a
 * later run would then reuse or collide with them.
 */
const named = [
  ...browsers.map(defaults.container),
  ...browsers.map((browser) => `browser-control-forward-${browser}`),
  ...browsers.map((browser) => `browser-control-forward-secure-${browser}`),
  "browser-control-forward-reuse",
];

await Promise.allSettled(named.map((name) => container.tryRemove(name)));

console.log("Posttest cleanup complete.");
