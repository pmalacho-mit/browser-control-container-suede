// long-lived background process
import { chromium, firefox, webkit } from "playwright";
import { writeFileSync, unlinkSync } from "node:fs";

const TYPES = { chromium, firefox, webkit };
type BrowserName = keyof typeof TYPES;

const BROWSER = (process.env.BROWSER || "chromium") as BrowserName;
if (!(BROWSER in TYPES))
  throw new Error(
    `Unsupported browser '${BROWSER}'! Options are: ${Object.keys(TYPES).join(", ")}`,
  );

const WS_FILE = process.env.WS_FILE || "/tmp/playwright-ws";

const server = await TYPES[BROWSER].launchServer({
  headless: true,
  args: BROWSER === "chromium" ? ["--no-sandbox"] : [],
});

writeFileSync(WS_FILE, server.wsEndpoint());

const cleanup = async () => {
  try {
    unlinkSync(WS_FILE);
  } catch {
    /* ignore */
  }
  await server.close();
  process.exit(0);
};
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

setInterval(() => {}, 1 << 30);
