import { test } from "node:test";
import assert from "node:assert/strict";
import { playwright } from "./release/index.js";
import { suite } from "./common.js";

suite(
  "run-code and storage",
  {
    serve: {
      title: "Storage Test",
      body: `<div id="app">ready</div>
      <script>
        localStorage.setItem('boot', 'ready');
        sessionStorage.setItem('page', 'storage-test');
      </script>`,
    },
    navigateInitialTab: true,
  },
  (fixture) => {
    test("run-code can mutate the page", async () => {
      const result = await playwright.run(
        fixture.container,
        [
          "run-code",
          "async page => { await page.locator('#app').evaluate(el => el.textContent = 'changed'); }",
        ],
        { session: fixture.session },
      );
      assert.equal(result.exit, 0, result.err);

      const snapshot = await playwright.run(fixture.container, ["snapshot"], {
        session: fixture.session,
      });
      assert.match(snapshot.out, /changed/);
    });

    test("localStorage get and set work", async () => {
      const set = await playwright.run(
        fixture.container,
        ["localstorage-set", "theme", "suede"],
        {
          session: fixture.session,
        },
      );
      assert.equal(set.exit, 0, set.err);

      const get = await playwright.run(
        fixture.container,
        ["localstorage-get", "theme"],
        {
          session: fixture.session,
          raw: true,
        },
      );
      assert.equal(get.exit, 0, get.err);
      assert.equal(get.out.trim(), "theme=suede");
    });

    test("sessionStorage list includes bootstrapped state", async () => {
      const list = await playwright.run(
        fixture.container,
        ["sessionstorage-list"],
        {
          session: fixture.session,
        },
      );
      assert.equal(list.exit, 0, list.err);
      assert.match(list.out, /page/);
      assert.match(list.out, /storage-test/);
    });

    test("localStorage delete removes a key", async () => {
      await playwright.run(
        fixture.container,
        ["localstorage-set", "transient", "gone"],
        {
          session: fixture.session,
        },
      );

      const remove = await playwright.run(
        fixture.container,
        ["localstorage-delete", "transient"],
        {
          session: fixture.session,
        },
      );
      assert.equal(remove.exit, 0, remove.err);

      const get = await playwright.run(
        fixture.container,
        ["localstorage-get", "transient"],
        {
          session: fixture.session,
          raw: true,
        },
      );
      assert.equal(get.exit, 0, get.err);
      assert.equal(get.out.trim(), "localStorage key 'transient' not found");
    });
  },
);
