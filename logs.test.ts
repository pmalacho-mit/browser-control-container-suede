import { test } from "node:test";
import assert from "node:assert/strict";
import { playwright } from "./release/index.js";
import { suite } from "./common.js";

suite(
  "console logs",
  {
    serve: {
      title: "Console Test",
      body: `<script>
        console.log('console-info-message');
        console.warn('console-warning-message');
        console.error('console-error-message');
      </script>`,
    },
    navigateInitialTab: true,
  },
  (fixture) => {
    test("console lists emitted messages", async () => {
      await new Promise((r) => setTimeout(r, 250));
      const logs = await playwright.run(fixture.container, ["console"], {
        session: fixture.session,
      });
      assert.equal(logs.exit, 0, logs.err);
      assert.match(logs.out, /console-info-message/);
      assert.match(logs.out, /console-warning-message/);
      assert.match(logs.out, /console-error-message/);
    });

    test("console warning filter excludes info logs", async () => {
      await new Promise((r) => setTimeout(r, 250));
      const logs = await playwright.run(
        fixture.container,
        ["console", "warning"],
        { session: fixture.session },
      );
      assert.equal(logs.exit, 0, logs.err);
      assert.match(logs.out, /console-warning-message|console-error-message/);
      assert.doesNotMatch(logs.out, /console-info-message/);
    });
  },
);
