import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import {
  waitForReady,
  closeTab,
  createTab,
  execScript,
  fetchCdpTargets,
} from "./common.js";
import { CDP_PORT } from "./config.js";

describe("tabs.js", () => {
  before(async () => {
    await waitForReady();
  });

  it("lists tabs", async () => {
    // Snapshot current page count before creating our tab
    const before = (await fetchCdpTargets()).filter((t) => t.type === "page");
    const tab = await createTab();
    try {
      const result = await execScript("tabs.js");
      assert.equal(result.exitCode, 0, `tabs.js failed: ${result.stderr}`);
      assert.ok(
        result.stdout.includes(`${before.length + 1} tab(s)`),
        `Expected "${before.length + 1} tab(s)" in stdout, got: ${result.stdout}`,
      );
    } finally {
      await closeTab(tab.id);
    }
  });

  it("count increases after new tab", async () => {
    // Snapshot current page count, then create 2 tabs
    const beforeTargets = (await fetchCdpTargets()).filter(
      (t) => t.type === "page",
    );
    const tab1 = await createTab();
    const tab2 = await createTab();
    try {
      const result = await execScript("tabs.js");
      assert.equal(result.exitCode, 0, `tabs.js failed: ${result.stderr}`);
      assert.ok(
        result.stdout.includes(`${beforeTargets.length + 2} tab(s)`),
        `Expected "${beforeTargets.length + 2} tab(s)" in stdout, got: ${result.stdout}`,
      );
    } finally {
      await closeTab(tab1.id);
      await closeTab(tab2.id);
    }
  });

  it("--close removes one tab", async () => {
    const tab1 = await createTab();
    const tab2 = await createTab();

    const close = await execScript("tabs.js", ["--close", tab2.id]);
    assert.equal(close.exitCode, 0, `tabs.js --close failed: ${close.stderr}`);

    try {
      // Verify tab2 is gone and tab1 still exists
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
      const targets = (
        (await res.json()) as Array<{ id: string; type: string }>
      ).filter((t) => t.type === "page");
      const ids = targets.map((t) => t.id);
      assert.ok(!ids.includes(tab2.id), "Closed tab should no longer appear");
      assert.ok(ids.includes(tab1.id), "Other tab should still exist");
    } finally {
      // tab2 was closed by the script; just close tab1
      await closeTab(tab1.id);
    }
  });

  it("--close-all leaves at most 1 tab", async () => {
    // Create 3 extra tabs so --close-all has something to do
    const tab1 = await createTab();
    const tab2 = await createTab();
    const tab3 = await createTab();

    const close = await execScript("tabs.js", ["--close-all"]);
    assert.equal(
      close.exitCode,
      0,
      `tabs.js --close-all failed: ${close.stderr}`,
    );

    const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
    const targets = ((await res.json()) as Array<{ type: string }>).filter(
      (t) => t.type === "page",
    );
    assert.ok(
      targets.length <= 1,
      `Expected at most 1 tab remaining, got ${targets.length}`,
    );
    // Any remaining tabs from our create calls were closed by the script;
    // do a best-effort cleanup on the one that may have survived (first created).
    for (const id of [tab1.id, tab2.id, tab3.id]) {
      await closeTab(id).catch(() => {});
    }
  });
});
