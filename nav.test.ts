import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execScript, fetchCdpTargets, scriptTestFixture } from "./common.js";

describe("nav.js", () => {
  const fixture = scriptTestFixture({
    title: "Nav Test",
    body: '<a href="/other">link</a>',
  });

  it("navigates current tab", async () => {
    const nav = await execScript("nav.js", [
      fixture.serverUrl,
      "--target",
      fixture.tab,
    ]);
    assert.equal(nav.exitCode, 0, `nav.js failed: ${nav.stderr}`);

    const evalResult = await execScript("eval.js", [
      "document.title",
      "--target",
      fixture.tab,
    ]);
    assert.equal(evalResult.exitCode, 0);
    assert.equal(evalResult.stdout.trim(), "Nav Test");
  });

  it("opens in a new tab with --new", async () => {
    const before = (await fetchCdpTargets())
      .filter((t) => t.type === "page")
      .map((t) => t.id);

    const nav = await execScript("nav.js", [fixture.serverUrl, "--new"]);
    assert.equal(nav.exitCode, 0, `nav.js --new failed: ${nav.stderr}`);

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
    const nav = await execScript("nav.js", [
      fixture.serverUrl,
      "--wait",
      "1",
      "--target",
      fixture.tab,
    ]);
    assert.equal(nav.exitCode, 0, `nav.js --wait failed: ${nav.stderr}`);
  });

  it("invalid URL exits non-zero", async () => {
    const nav = await execScript("nav.js", [
      "not-a-url",
      "--target",
      fixture.tab,
    ]);
    assert.notEqual(nav.exitCode, 0);
  });
});
