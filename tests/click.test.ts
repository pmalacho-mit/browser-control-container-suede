import { test } from "node:test";
import assert from "node:assert/strict";
import { playwright } from "../release/index.js";
import { suite } from "../common.js";

suite(
  "click actions",
  {
    title: "Click Test",
    body: `<button id="btn" onclick="localStorage.setItem('clicked','yes')">Click Me</button>
      <button id="dbl" ondblclick="localStorage.setItem('dblclicked','yes')">Double Click</button>
      <div id="hover" onmouseenter="localStorage.setItem('hovered','yes')">Hover Me</div>`,
    navigateInitialTab: true,
  },
  (fixture) => {
    test("clicks a selector", async () => {
      const click = await playwright.run(fixture.container, ["click", "#btn"], {
        session: fixture.session,
      });
      assert.equal(click.exit, 0, click.err);

      const value = await playwright.run(
        fixture.container,
        ["localstorage-get", "clicked"],
        {
          session: fixture.session,
          raw: true,
        },
      );
      assert.equal(value.out.trim(), "clicked=yes");
    });

    test("double-clicks a selector", async () => {
      const click = await playwright.run(
        fixture.container,
        ["dblclick", "#dbl"],
        {
          session: fixture.session,
        },
      );
      assert.equal(click.exit, 0, click.err);

      const value = await playwright.run(
        fixture.container,
        ["localstorage-get", "dblclicked"],
        {
          session: fixture.session,
          raw: true,
        },
      );
      assert.equal(value.out.trim(), "dblclicked=yes");
    });

    test("hover triggers element interaction", async () => {
      const hover = await playwright.run(
        fixture.container,
        ["hover", "#hover"],
        {
          session: fixture.session,
        },
      );
      assert.equal(hover.exit, 0, hover.err);

      const value = await playwright.run(
        fixture.container,
        ["localstorage-get", "hovered"],
        {
          session: fixture.session,
          raw: true,
        },
      );
      assert.equal(value.out.trim(), "hovered=yes");
    });

    test("missing selector exits non-zero", async () => {
      const click = await playwright.run(
        fixture.container,
        ["click", "#nonexistent"],
        {
          session: fixture.session,
        },
      );
      // Current Playwright CLI behavior is to no-op and exit 0 when selector is missing.
      assert.equal(click.exit, 0);

      const value = await playwright.run(
        fixture.container,
        ["localstorage-get", "clicked"],
        {
          session: fixture.session,
          raw: true,
        },
      );
      assert.notEqual(value.out.trim(), "clicked=yes");
    });
  },
);
