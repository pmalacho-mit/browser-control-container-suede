import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runPlaywright, createFixture } from "../common.js";

describe("playwright-cli tabs", () => {
  const fixture = fixture({
    title: "Tabs Test",
    body: "<p>tab body</p>",
    navigateInitialTab: true,
  });

  it("tab-list shows the current tab", async () => {
    const list = await runPlaywright(["tab-list"], {
      session: fixture.session,
    });
    assert.equal(list.exit, 0, list.err);
    assert.match(list.out, /0: \(current\)/);
  });

  it("tab-new adds another tab", async () => {
    const created = await runPlaywright(
      ["tab-new", `${fixture.serverUrl}?tab=2`],
      {
        session: fixture.session,
      },
    );
    assert.equal(created.exit, 0, created.err);

    const list = await runPlaywright(["tab-list"], {
      session: fixture.session,
    });
    assert.match(list.out, /0: \(current\)/);
    assert.match(list.out, /1:/);
    assert.match(list.out, /tab=2/);
  });

  it("tab-select changes the current tab", async () => {
    await runPlaywright(["tab-new", `${fixture.serverUrl}?tab=2`], {
      session: fixture.session,
    });

    const select = await runPlaywright(["tab-select", "1"], {
      session: fixture.session,
    });
    assert.equal(select.exit, 0, select.err);

    const list = await runPlaywright(["tab-list"], {
      session: fixture.session,
    });
    assert.match(list.out, /1: \(current\)/);
  });

  it("tab-close removes a tab", async () => {
    await runPlaywright(["tab-new", `${fixture.serverUrl}?tab=2`], {
      session: fixture.session,
    });

    const close = await runPlaywright(["tab-close", "1"], {
      session: fixture.session,
    });
    assert.equal(close.exit, 0, close.err);

    const list = await runPlaywright(["tab-list"], {
      session: fixture.session,
    });
    assert.doesNotMatch(list.out, /1:/);
  });
});
