import { test } from "node:test";
import assert from "node:assert/strict";
import { playwright } from "./release/index.js";
import { suite } from "./common.js";

suite(
  "tab management",
  {
    serve: {
      title: "Tabs Test",
      body: "<p>tab body</p>",
    },
    navigateInitialTab: true,
  },
  (fixture) => {
    test("tab-list shows the current tab", async () => {
      const list = await playwright.run(fixture.container, ["tab-list"], {
        session: fixture.session,
      });
      assert.equal(list.exit, 0, list.err);
      assert.match(list.out, /0: \(current\)/);
    });

    test("tab-new adds another tab", async () => {
      const created = await playwright.run(
        fixture.container,
        ["tab-new", `${fixture.serverUrl}?tab=2`],
        { session: fixture.session },
      );
      assert.equal(created.exit, 0, created.err);

      const list = await playwright.run(fixture.container, ["tab-list"], {
        session: fixture.session,
      });
      /**
       * Anchored to the start of a `tab-list` entry. An unanchored `1:` also
       * matches inside the URL these entries carry — an address ending in `.1`
       * is enough — which is a false match rather than a tab index.
       */
      assert.match(list.out, /^- 0:/m);
      assert.match(list.out, /^- 1: \(current\)/m);
      assert.match(list.out, /tab=2/);
    });

    test("tab-select changes the current tab", async () => {
      await playwright.run(
        fixture.container,
        ["tab-new", `${fixture.serverUrl}?tab=2`],
        { session: fixture.session },
      );

      const select = await playwright.run(
        fixture.container,
        ["tab-select", "1"],
        { session: fixture.session },
      );
      assert.equal(select.exit, 0, select.err);

      const list = await playwright.run(fixture.container, ["tab-list"], {
        session: fixture.session,
      });
      assert.match(list.out, /^- 1: \(current\)/m);
    });

    test("tab-close removes a tab", async () => {
      await playwright.run(
        fixture.container,
        ["tab-new", `${fixture.serverUrl}?tab=2`],
        { session: fixture.session },
      );

      const close = await playwright.run(
        fixture.container,
        ["tab-close", "1"],
        { session: fixture.session },
      );
      assert.equal(close.exit, 0, close.err);

      const list = await playwright.run(fixture.container, ["tab-list"], {
        session: fixture.session,
      });
      assert.doesNotMatch(list.out, /^- 1:/m);
    });
  },
);
