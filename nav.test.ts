import { test } from "node:test";
import assert from "node:assert/strict";
import { playwright } from "./release/index.js";
import { suite } from "./common.js";

suite(
  "navigation",
  {
    serve: (req, res) => {
      const isOther = req.url === "/other";
      const title = isOther ? "Other Page" : "Nav Test";
      const body = isOther
        ? '<h1>Other Page</h1><a href="/">back</a>'
        : '<h1>Nav Test</h1><a href="/other">next</a>';
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        `<!DOCTYPE html><html><head><title>${title}</title></head><body>${body}</body></html>`,
      );
    },
    navigateInitialTab: false,
  },
  (fixture) => {
    test("goto navigates the current tab", async () => {
      const nav = await playwright.run(
        fixture.container,
        ["goto", fixture.serverUrl],
        { session: fixture.session },
      );
      assert.equal(nav.exit, 0, nav.err);

      const snapshot = await playwright.run(fixture.container, ["snapshot"], {
        session: fixture.session,
      });
      assert.equal(snapshot.exit, 0, snapshot.err);
      assert.match(snapshot.out, /Nav Test/);
    });

    test("go-back and go-forward move through history", async () => {
      await playwright.run(fixture.container, ["goto", fixture.serverUrl], {
        session: fixture.session,
      });
      await playwright.run(
        fixture.container,
        ["goto", `${fixture.serverUrl}/other`],
        { session: fixture.session },
      );

      const back = await playwright.run(fixture.container, ["go-back"], {
        session: fixture.session,
      });
      assert.equal(back.exit, 0, back.err);

      const backSnapshot = await playwright.run(
        fixture.container,
        ["snapshot"],
        { session: fixture.session },
      );
      assert.match(backSnapshot.out, /Nav Test/);

      const forward = await playwright.run(fixture.container, ["go-forward"], {
        session: fixture.session,
      });
      assert.equal(forward.exit, 0, forward.err);

      const forwardSnapshot = await playwright.run(
        fixture.container,
        ["snapshot"],
        { session: fixture.session },
      );
      assert.match(forwardSnapshot.out, /Other Page/);
    });

    test("invalid url returns error (but exits 0)", async () => {
      const nav = await playwright.exec(
        fixture.container,
        ["goto", "not-a-url"],
        {
          session: fixture.session,
        },
      );
      assert.equal(await playwright.errored(nav), true);
      assert.equal((await nav.complete()).exit, 0);
    });
  },
);
