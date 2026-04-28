import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runPlaywright, createFixture } from "../common.js";
import { sleep } from "../utils.js";

describe("playwright-cli network", () => {
  const fixture = fixture({
    title: "Network Test",
    body: `<script>
      fetch('/api/data').catch(() => {});
      fetch('/missing').catch(() => {});
    </script>`,
    navigateInitialTab: true,
  });

  it("network lists page requests", async () => {
    await sleep(500);
    const network = await runPlaywright(["network"], {
      session: fixture.session,
    });
    assert.equal(network.exit, 0, network.err);
    assert.match(network.out, /api\/data/);
    assert.match(network.out, /missing/);
  });

  it("route-list reflects added and removed routes", async () => {
    const route = await runPlaywright(
      ["route", "**/api/mock", "--status=204"],
      {
        session: fixture.session,
      },
    );
    assert.equal(route.exit, 0, route.err);

    const listed = await runPlaywright(["route-list"], {
      session: fixture.session,
    });
    assert.match(listed.out, /api\/mock/);

    const removed = await runPlaywright(["unroute", "**/api/mock"], {
      session: fixture.session,
    });
    assert.equal(removed.exit, 0, removed.err);
  });
});
