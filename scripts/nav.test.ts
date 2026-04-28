import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  closeSession,
  openSession,
  runPlaywright,
  startTestServer,
  waitForReady,
} from "../common.js";

describe("playwright-cli navigation", () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let session: string;
  let counter = 0;

  before(async () => {
    await waitForReady();
    server = await startTestServer((req, res) => {
      const title = req.url === "/other" ? "Other Page" : "Nav Test";
      const body =
        req.url === "/other"
          ? '<h1>Other Page</h1><a href="/">back</a>'
          : '<h1>Nav Test</h1><a href="/other">next</a>';

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        `<!DOCTYPE html><html><head><title>${title}</title></head><body>${body}</body></html>`,
      );
    });
  });

  beforeEach(async (test) => {
    session = `nav-${process.pid}-${counter++}`;
    await openSession(session, "about:blank");
    test.after(async () => {
      await closeSession(session).catch(() => {});
    });
  });

  after(async () => {
    await server.close();
  });

  it("goto navigates the current tab", async () => {
    const nav = await runPlaywright(["goto", server.url], { session });
    assert.equal(nav.exit, 0, nav.err);

    const snapshot = await runPlaywright(["snapshot"], { session });
    assert.equal(snapshot.exit, 0, snapshot.err);
    assert.match(snapshot.out, /Nav Test/);
  });

  it("go-back and go-forward move through history", async () => {
    await runPlaywright(["goto", server.url], { session });
    await runPlaywright(["goto", `${server.url}/other`], { session });

    const back = await runPlaywright(["go-back"], { session });
    assert.equal(back.exit, 0, back.err);

    const backSnapshot = await runPlaywright(["snapshot"], { session });
    assert.match(backSnapshot.out, /Nav Test/);

    const forward = await runPlaywright(["go-forward"], { session });
    assert.equal(forward.exit, 0, forward.err);

    const forwardSnapshot = await runPlaywright(["snapshot"], { session });
    assert.match(forwardSnapshot.out, /Other Page/);
  });

  it("invalid url exits non-zero", async () => {
    const nav = await runPlaywright(["goto", "not-a-url"], { session });
    assert.notEqual(nav.exit, 0);
  });
});
