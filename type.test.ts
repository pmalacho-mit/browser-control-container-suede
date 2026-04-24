import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execScript, evalTab, scriptTestFixture } from "./common.js";

describe("type.js", () => {
  const fixture = scriptTestFixture({
    title: "Type Test",
    body: `
<form onsubmit="window._submitted=true; return false">
  <input id="inp" type="text" />
  <button type="submit">Go</button>
</form>`,
    navigateInitialTab: true,
  });

  it("types into input", async () => {
    // Clear any prior value
    await evalTab(fixture.tab, "document.querySelector('#inp').value=''");

    const type = await execScript("type.js", [
      "#inp",
      "hello world",
      "--target",
      fixture.tab,
    ]);
    assert.equal(type.exitCode, 0, `type.js failed: ${type.stderr}`);

    const evalResult = await evalTab(
      fixture.tab,
      "document.querySelector('#inp').value",
    );
    assert.equal(evalResult.exitCode, 0);
    assert.equal(evalResult.stdout.trim(), "hello world");
  });

  it("--clear wipes existing value", async () => {
    // Pre-fill with "foo"
    await evalTab(fixture.tab, "document.querySelector('#inp').value=''");
    await execScript("type.js", ["#inp", "foo", "--target", fixture.tab]);

    // Type "bar" with --clear
    const type = await execScript("type.js", [
      "#inp",
      "bar",
      "--clear",
      "--target",
      fixture.tab,
    ]);
    assert.equal(type.exitCode, 0, `type.js --clear failed: ${type.stderr}`);

    const evalResult = await evalTab(
      fixture.tab,
      "document.querySelector('#inp').value",
    );
    assert.equal(evalResult.exitCode, 0);
    assert.equal(evalResult.stdout.trim(), "bar");
  });

  it("--enter dispatches submit", async () => {
    // Reset the flag set by the form's onsubmit handler.
    await evalTab(fixture.tab, "window._submitted = false");

    const type = await execScript("type.js", [
      "#inp",
      "x",
      "--enter",
      "--target",
      fixture.tab,
    ]);
    assert.equal(type.exitCode, 0, `type.js --enter failed: ${type.stderr}`);

    // Chrome should translate the CDP Enter keyDown into a form submission,
    // which fires the form's onsubmit handler setting window._submitted.
    const evalResult = await evalTab(fixture.tab, "window._submitted");
    assert.equal(evalResult.exitCode, 0);
    assert.equal(evalResult.stdout.trim(), "true");
  });

  it("missing selector exits non-zero", async () => {
    const type = await execScript("type.js", [
      "#missing",
      "text",
      "--target",
      fixture.tab,
    ]);
    assert.notEqual(type.exitCode, 0);
  });
});
