import { test } from "node:test";
import assert from "node:assert/strict";
import { playwright } from "./release/index.js";
import { suite } from "./common.js";

suite(
  "text input",
  {
    serve: {
      title: "Type Test",
      body: `<form onsubmit="localStorage.setItem('submitted', document.querySelector('#inp').value); return false">
        <input id="inp" type="text" oninput="localStorage.setItem('typed', this.value)" />
        <button type="submit">Go</button>
      </form>`,
    },
    navigateInitialTab: true,
  },
  (fixture) => {
    test("fill writes a full value into an input", async () => {
      const fill = await playwright.run(
        fixture.container,
        ["fill", "#inp", "hello world"],
        { session: fixture.session },
      );
      assert.equal(fill.exit, 0, fill.err);

      const value = await playwright.run(
        fixture.container,
        ["localstorage-get", "typed"],
        { session: fixture.session, raw: true },
      );
      assert.equal(value.out.trim(), "typed=hello world");
    });

    test("type appends through the focused editable element", async () => {
      await playwright.run(fixture.container, ["click", "#inp"], {
        session: fixture.session,
      });

      const type = await playwright.run(fixture.container, ["type", "abc"], {
        session: fixture.session,
      });
      assert.equal(type.exit, 0, type.err);

      const snapshot = await playwright.run(fixture.container, ["snapshot"], {
        session: fixture.session,
      });
      assert.match(snapshot.out, /abc/);
    });

    test("press Enter submits the focused form", async () => {
      await playwright.run(fixture.container, ["fill", "#inp", "submitted"], {
        session: fixture.session,
      });
      await playwright.run(fixture.container, ["click", "#inp"], {
        session: fixture.session,
      });

      const press = await playwright.run(
        fixture.container,
        ["press", "Enter"],
        {
          session: fixture.session,
        },
      );
      assert.equal(press.exit, 0, press.err);

      const value = await playwright.run(
        fixture.container,
        ["localstorage-get", "submitted"],
        { session: fixture.session, raw: true },
      );
      assert.equal(value.out.trim(), "submitted=submitted");
    });

    test("missing selector exits non-zero", async () => {
      const fill = await playwright.exec(
        fixture.container,
        ["fill", "#missing", "text"],
        {
          session: fixture.session,
        },
      );
      assert.equal(await playwright.errored(fill), true);
      assert.equal((await fill.complete()).exit, 0);
    });
  },
);
