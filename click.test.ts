import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execScript, evalTab, scriptTestFixture } from "./common.js";

describe("click.js", () => {
  const fixture = scriptTestFixture({
    title: "Click Test",
    body: '<button id="btn" onclick="window._clicked=true">Click Me</button>',
    navigateInitialTab: true,
  });

  it("clicks by CSS selector", async () => {
    // Reset state
    await evalTab(fixture.tab, "window._clicked=false");

    const click = await execScript("click.js", [
      "#btn",
      "--target",
      fixture.tab,
    ]);
    assert.equal(click.exitCode, 0, `click.js failed: ${click.stderr}`);

    const evalResult = await evalTab(fixture.tab, "window._clicked");
    assert.equal(evalResult.exitCode, 0);
    assert.equal(evalResult.stdout.trim(), "true");
  });

  it("clicks by coordinates", async () => {
    // Reset state
    await evalTab(fixture.tab, "window._clicked=false");

    // Get button center coordinates
    const rectResult = await evalTab(
      fixture.tab,
      `JSON.stringify((() => { const r = document.querySelector('#btn').getBoundingClientRect(); return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) }; })())`,
    );
    assert.equal(rectResult.exitCode, 0);
    const coords = JSON.parse(rectResult.stdout.trim());

    const click = await execScript("click.js", [
      "--xy",
      `${coords.x},${coords.y}`,
      "--target",
      fixture.tab,
    ]);
    assert.equal(click.exitCode, 0, `click.js --xy failed: ${click.stderr}`);

    const evalResult = await evalTab(fixture.tab, "window._clicked");
    assert.equal(evalResult.exitCode, 0);
    assert.equal(evalResult.stdout.trim(), "true");
  });

  it("clicks with --wait", async () => {
    const click = await execScript("click.js", [
      "#btn",
      "--wait",
      "1",
      "--target",
      fixture.tab,
    ]);
    assert.equal(click.exitCode, 0, `click.js --wait failed: ${click.stderr}`);
  });

  it("missing selector exits non-zero", async () => {
    const click = await execScript("click.js", [
      "#nonexistent",
      "--target",
      fixture.tab,
    ]);
    assert.notEqual(click.exitCode, 0);
  });
});
