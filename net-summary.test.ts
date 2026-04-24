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

describe("net-summary.js", () => {
  let tabId: string;
  let server: Awaited<ReturnType<typeof startTestServer>>;

  before(async () => {
    await waitForReady();

    server = await startTestServer((req, res) => {
      if (req.url === "/api/data") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      if (req.url === "/will-404") {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<!DOCTYPE html><html><head><title>Net Summary Test</title></head><body>
        <script>
          fetch('/api/data');
          fetch('/will-404');
        </script>
      </body></html>`);
    });

    const tab = await createTab();
    tabId = tab.id;

    // Run watcher briefly to populate network logs
    await withWatcher(tabId, async () => {
      await navigateTab(tabId, server.url);
      await new Promise((r) => setTimeout(r, 1000));
    });
  });

  after(async () => {
    await closeTab(tabId);
    await server?.close();
  });

  it("shows network summary", async () => {
    const summary = await execScript("net-summary.js");
    assert.equal(
      summary.exitCode,
      0,
      `net-summary.js failed: ${summary.stderr}`,
    );
    assert.ok(
      summary.stdout.includes("Network Summary"),
      `Expected "Network Summary" in stdout, got: ${summary.stdout}`,
    );
    // Verify at least one request was actually recorded (the page fetched /api/data and /will-404)
    const match = summary.stdout.match(/Total requests:\s+(\d+)/);
    assert.ok(
      match && parseInt(match[1], 10) > 0,
      `Expected at least 1 recorded request, got: ${summary.stdout}`,
    );
  });

  it("--errors shows only failures", async () => {
    const errors = await execScript("net-summary.js", ["--errors"]);
    assert.equal(
      errors.exitCode,
      0,
      `net-summary.js --errors failed: ${errors.stderr}`,
    );
    // Should mention the 404 endpoint
    assert.ok(
      errors.stdout.includes("/will-404") || errors.stdout.includes("404"),
      `Expected /will-404 or 404 in error output, got: ${errors.stdout}`,
    );
    // Should NOT mention the successful endpoint in the errors-only view
    // (net-summary --errors shows only failed requests and status >= 400)
    // /api/data returned 200, so it should not appear
    assert.ok(
      !errors.stdout.includes("/api/data"),
      `Did not expect /api/data in errors-only output, got: ${errors.stdout}`,
    );
  });
});
