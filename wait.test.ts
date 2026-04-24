import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  waitForReady,
  closeTab,
  createTab,
  execScript,
  navigateTab,
  startTestServer,
} from "./common.js";

describe("wait.js", { concurrency: 1 }, () => {
  let tabId: string;
  let server: Awaited<ReturnType<typeof startTestServer>>;

  before(async () => {
    await waitForReady();

    server = await startTestServer((req, res) => {
      if (req.url === "/ping") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("pong");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<!DOCTYPE html><html><head><title>Wait Test</title></head><body>
        <script>
          setTimeout(() => {
            const el = document.createElement('div');
            el.className = 'delayed';
            el.textContent = 'appeared';
            document.body.appendChild(el);
          }, 300);
          fetch('/ping');
        </script>
      </body></html>`);
    });

    const tab = await createTab();
    tabId = tab.id;
  });

  after(async () => {
    await closeTab(tabId);
    await server?.close();
  });

  it("waits for selector that appears", async () => {
    await navigateTab(tabId, server.url);

    const wait = await execScript("wait.js", [".delayed", "--target", tabId]);
    assert.equal(wait.exitCode, 0, `wait.js failed: ${wait.stderr}`);
  });

  it("times out before element appears", async () => {
    // Use a selector that will never appear and a short-enough timeout that
    // docker exec completes reliably (docker exec drops idle connections > ~0.5s).
    const wait = await execScript("wait.js", [
      ".nonexistent-xyz123",
      "--timeout",
      "0.05",
      "--target",
      tabId,
    ]);
    assert.notEqual(wait.exitCode, 0);
  });

  it("--load on already-loaded page", async () => {
    await navigateTab(tabId, server.url);
    // Start wait.js first so it has time to attach its loadEventFired listener
    // before the navigation (triggered below) fires the event.
    const waitPromise = execScript("wait.js", ["--load", "--target", tabId]);
    // Give wait.js time to connect to CDP and register the listener.
    await new Promise((r) => setTimeout(r, 300));
    // Now trigger a fresh load; wait.js should catch the event.
    await execScript("nav.js", [server.url, "--target", tabId]);
    const wait = await waitPromise;
    assert.equal(wait.exitCode, 0, `wait.js --load failed: ${wait.stderr}`);
  });

  it("--idle resolves", async () => {
    await navigateTab(tabId, server.url);
    // Give network activity time to start and finish
    await new Promise((r) => setTimeout(r, 500));

    const wait = await execScript("wait.js", ["--idle", "--target", tabId]);
    assert.equal(wait.exitCode, 0, `wait.js --idle failed: ${wait.stderr}`);
  });
});
