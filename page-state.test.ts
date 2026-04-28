import { test } from "node:test";
import assert from "node:assert/strict";
import { playwright } from "./release/index.js";
import { suite } from "./common.js";

suite(
  "page state",
  {
    serve: {
      title: "Page State Test",
      body: `<script>
        const current = Number(sessionStorage.getItem('loads') || '0');
        sessionStorage.setItem('loads', String(current + 1));
      </script>
      <h1>Page State</h1>`,
    },
    navigateInitialTab: true,
  },
  (fixture) => {
    test("reload refreshes the current page", async () => {
      const reload = await playwright.run(fixture.container, ["reload"], {
        session: fixture.session,
      });
      assert.equal(reload.exit, 0, reload.err);

      const loads = await playwright.run(
        fixture.container,
        ["sessionstorage-get", "loads"],
        { session: fixture.session, raw: true },
      );
      assert.equal(loads.out.trim(), "loads=2");
    });

    test("resize completes successfully", async () => {
      const resize = await playwright.run(
        fixture.container,
        ["resize", "1280", "720"],
        { session: fixture.session },
      );
      assert.equal(resize.exit, 0, resize.err);
    });
  },
);
