import { test } from "node:test";
import assert from "node:assert/strict";
import { playwright } from "./release/index.js";
import { suite } from "./common.js";

suite(
  "DOM snapshot and locator generation",
  {
    serve: {
      title: "DOM Test",
      body: `<h1>Main Heading</h1>
      <a href="/x">Test Link</a>
      <input type="text" id="myinput" placeholder="enter text" />
      <p>visible text here</p>`,
    },
    navigateInitialTab: true,
  },
  (fixture) => {
    test("default snapshot contains page info", async () => {
      const snapshot = await playwright.run(fixture.container, ["snapshot"], {
        session: fixture.session,
      });
      assert.equal(snapshot.exit, 0, snapshot.err);
      assert.match(snapshot.out, /DOM Test/);
      assert.match(snapshot.out, /Main Heading/);
    });

    test("scoped snapshot captures only the matching subtree", async () => {
      const snapshot = await playwright.run(
        fixture.container,
        ["snapshot", "h1"],
        {
          session: fixture.session,
        },
      );
      assert.equal(snapshot.exit, 0, snapshot.err);
      assert.match(snapshot.out, /Main Heading/);
      assert.doesNotMatch(snapshot.out, /Test Link/);
    });

    test("boxes option includes element geometry", async () => {
      const snapshot = await playwright.run(
        fixture.container,
        ["snapshot", "--boxes"],
        {
          session: fixture.session,
        },
      );
      assert.equal(snapshot.exit, 0, snapshot.err);
      assert.match(snapshot.out, /\[box=/);
    });

    test("generate-locator returns a usable locator", async () => {
      const locator = await playwright.run(
        fixture.container,
        ["generate-locator", "#myinput"],
        {
          session: fixture.session,
          raw: true,
        },
      );
      assert.equal(locator.exit, 0, locator.err);
      assert.ok(locator.out.trim().length > 0, "Expected locator output");
    });
  },
);
