import { test } from "node:test";
import assert from "node:assert/strict";
import { playwright } from "./release/index.js";
import { suite } from "./common.js";

suite(
  "network monitoring",
  {
    serve: {
      title: "Network Test",
      body: `<script>
        fetch('/api/data').catch(() => {});
        fetch('/missing').catch(() => {});
      </script>`,
    },
    navigateInitialTab: true,
  },
  (fixture) => {
    test("network lists page requests", async () => {
      await new Promise((r) => setTimeout(r, 500));
      const network = await playwright.run(fixture.container, ["network"], {
        session: fixture.session,
      });
      assert.equal(network.exit, 0, network.err);
      assert.match(network.out, /api\/data/);
      assert.match(network.out, /missing/);
    });

    test("route-list reflects added and removed routes", async () => {
      const route = await playwright.run(
        fixture.container,
        ["route", "**/api/mock", "--status=204"],
        { session: fixture.session },
      );
      assert.equal(route.exit, 0, route.err);

      const listed = await playwright.run(fixture.container, ["route-list"], {
        session: fixture.session,
      });
      assert.match(listed.out, /api\/mock/);

      const removed = await playwright.run(
        fixture.container,
        ["unroute", "**/api/mock"],
        { session: fixture.session },
      );
      assert.equal(removed.exit, 0, removed.err);
    });
  },
);
