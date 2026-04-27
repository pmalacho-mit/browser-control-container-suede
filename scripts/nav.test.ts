import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execScript, fetchCdpTargets, scriptTestFixture } from "../common.js";

describe("nav.ts", () => {
  const fixture = scriptTestFixture({
    title: "Nav Test",
    body: '<a href="/other">link</a>',
  });

  it("navigates current tab", async () => {
    const nav = await execScript("nav.ts", [
      fixture.serverUrl,
      "--target",
      fixture.tab,
    ]).complete();
    assert.equal(nav.exit, 0, `nav.ts failed: ${nav.err}`);

    const evalResult = await execScript("eval.ts", [
      "document.title",
      "--target",
      fixture.tab,
    ]).complete();
    assert.equal(evalResult.exit, 0);
    assert.equal(evalResult.out.trim(), "Nav Test");
  });

  it("opens in a new tab with --new", async () => {
    const before = (await fetchCdpTargets())
      .filter((t) => t.type === "page")
      .map((t) => t.id);

    const nav = await execScript("nav.ts", [
      fixture.serverUrl,
      "--new",
    ]).complete();
    assert.equal(nav.exit, 0, `nav.ts --new failed: ${nav.err}`);

    const after = (await fetchCdpTargets())
      .filter((t) => t.type === "page")
      .map((t) => t.id);

    const added = after.filter((id) => !before.includes(id));
    assert.equal(
      added.length,
      1,
      `Expected exactly 1 new tab, got ${added.length}`,
    );
    fixture.tabs.push(added[0]);
  });

  it("--wait flag does not error", async () => {
    const nav = await execScript("nav.ts", [
      fixture.serverUrl,
      "--wait",
      "1",
      "--target",
      fixture.tab,
    ]).complete();
    assert.equal(nav.exit, 0, `nav.ts --wait failed: ${nav.err}`);
  });

  it("invalid URL exits non-zero", async () => {
    const nav = await execScript("nav.ts", [
      "not-a-url",
      "--target",
      fixture.tab,
    ]).complete();
    assert.notEqual(nav.exit, 0);
  });
});
