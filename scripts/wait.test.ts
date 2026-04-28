import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  closeSession,
  openSession,
  runPlaywright,
  startTestServer,
  waitForReady,
} from "../common.js";

describe("playwright-cli page state", () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let session: string;
  let counter = 0;

  before(async () => {
    await waitForReady();
    server = await startTestServer((req, res) => {
      const title = req.url === "/b" ? "Page B" : "Page A";
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<!DOCTYPE html><html><head><title>${title}</title></head><body>
        <script>
          const current = Number(sessionStorage.getItem('loads') || '0');
          sessionStorage.setItem('loads', String(current + 1));
        </script>
        <h1>${title}</h1>
      </body></html>`);
    });
  });

  beforeEach(async (test) => {
    session = `page-state-${process.pid}-${counter++}`;
    await openSession(session, `${server.url}/a`);
    test.after(async () => {
      await closeSession(session).catch(() => {});
    });
  });

  after(async () => {
    await server.close();
  });

  it("reload refreshes the current page", async () => {
    const reload = await runPlaywright(["reload"], { session });
    assert.equal(reload.exit, 0, reload.err);

    const loads = await runPlaywright(["sessionstorage-get", "loads"], {
      session,
      raw: true,
    });
    assert.equal(loads.out.trim(), "2");
  });

  it("go-back returns to the previous page after navigation", async () => {
    await runPlaywright(["goto", `${server.url}/b`], { session });

    const back = await runPlaywright(["go-back"], { session });
    assert.equal(back.exit, 0, back.err);

    const snapshot = await runPlaywright(["snapshot"], { session });
    assert.match(snapshot.out, /Page A/);
  });

  it("resize completes successfully", async () => {
    const resize = await runPlaywright(["resize", "1280", "720"], {
      session,
    });
    assert.equal(resize.exit, 0, resize.err);
  });
});
