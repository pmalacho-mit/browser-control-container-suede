import { test } from "node:test";
import assert from "node:assert/strict";
import { playwright } from "./release/index.js";
import { suite } from "./common.js";

suite(
  "devtools helpers",
  {
    serve: {
      title: "Devtools Test",
      body: `<button id="action">Action</button><div id="output"></div>`,
    },
    navigateInitialTab: true,
  },
  (fixture) => {
    test("highlight and hide both succeed", async () => {
      const highlight = await playwright.run(
        fixture.container,
        ["highlight", "#action"],
        { session: fixture.session },
      );
      assert.equal(highlight.exit, 0, highlight.err);

      const hide = await playwright.run(
        fixture.container,
        ["highlight", "#action", "--hide"],
        { session: fixture.session },
      );
      assert.equal(hide.exit, 0, hide.err);
    });

    test("generate-locator emits a locator for an element", async () => {
      const locator = await playwright.run(
        fixture.container,
        ["generate-locator", "#action"],
        { session: fixture.session, raw: true },
      );
      assert.equal(locator.exit, 0, locator.err);
      assert.ok(locator.out.trim().length > 0, "Expected locator output");
    });

    test("run-code can update the page for later commands", async () => {
      const code = await playwright.run(
        fixture.container,
        [
          "run-code",
          "async page => { await page.locator('#output').evaluate(el => el.textContent = 'updated'); }",
        ],
        { session: fixture.session },
      );
      assert.equal(code.exit, 0, code.err);

      const snapshot = await playwright.run(fixture.container, ["snapshot"], {
        session: fixture.session,
      });
      assert.match(snapshot.out, /updated/);
    });
  },
);
