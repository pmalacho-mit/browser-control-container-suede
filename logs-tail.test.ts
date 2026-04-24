import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  waitForReady,
  closeTab,
  createTab,
  execScript,
  navigateTab,
  startTestServer,
  withWatcher,
} from "./common.js";

describe("logs-tail.js", () => {
  let tabId: string;
  let server: Awaited<ReturnType<typeof startTestServer>>;

  before(async () => {
    await waitForReady();

    server = await startTestServer((req, res) => {
      if (req.url === "/data") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<!DOCTYPE html><html><head><title>Logs Test</title></head><body>
        <script>
          console.log("logs-test-console-msg");
          fetch("/data");
        </script>
      </body></html>`);
    });

    const tab = await createTab();
    tabId = tab.id;

    // Run watcher briefly to populate a log file
    await withWatcher(tabId, async () => {
      await navigateTab(tabId, server.url);
      // Wait for console + network events to be recorded
      await new Promise((r) => setTimeout(r, 500));
    });
  });

  after(async () => {
    await closeTab(tabId);
    await server?.close();
  });

  it("dumps latest log", async () => {
    const tail = await execScript("logs-tail.js");
    assert.equal(tail.exitCode, 0, `logs-tail.js failed: ${tail.stderr}`);
    // stdout should have some content
    assert.ok(
      tail.stdout.trim().length > 0,
      "Expected non-empty output from logs-tail.js",
    );
  });

  it("--kind console filters to console entries", async () => {
    const tail = await execScript("logs-tail.js", ["--kind", "console"]);
    assert.equal(
      tail.exitCode,
      0,
      `logs-tail.js --kind console failed: ${tail.stderr}`,
    );

    // Every non-empty output line should be a console entry
    // logs-tail.js formats lines as "time  kind  detail", check kind column
    const lines = tail.stdout.split("\n").filter((l) => l.trim().length > 0);
    assert.ok(lines.length > 0, "Expected at least one line");
    for (const line of lines) {
      assert.ok(
        line.includes("console"),
        `Expected every line to contain "console", got: ${line}`,
      );
    }
  });

  it("--kind net filters to network entries", async () => {
    const tail = await execScript("logs-tail.js", ["--kind", "net"]);
    assert.equal(
      tail.exitCode,
      0,
      `logs-tail.js --kind net failed: ${tail.stderr}`,
    );

    const lines = tail.stdout.split("\n").filter((l) => l.trim().length > 0);
    assert.ok(lines.length > 0, "Expected at least one net line");
    for (const line of lines) {
      assert.ok(
        line.includes("net:"),
        `Expected every line to contain "net:", got: ${line}`,
      );
    }
  });
});
