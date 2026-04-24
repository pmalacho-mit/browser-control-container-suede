import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execScript, navigateTab, scriptTestFixture } from "./common.js";

describe("eval.js", () => {
  const fixture = scriptTestFixture({
    title: "Eval Page",
    body: "",
  });

  it("evaluates synchronous expression", async () => {
    const result = await execScript("eval.js", [
      "2+2",
      "--target",
      fixture.tab,
    ]);
    assert.equal(result.exitCode, 0, `eval.js failed: ${result.stderr}`);
    assert.equal(result.stdout.trim(), "4");
  });

  it("evaluates await expression", async () => {
    const result = await execScript("eval.js", [
      "await Promise.resolve(99)",
      "--target",
      fixture.tab,
    ]);
    assert.equal(result.exitCode, 0, `eval.js failed: ${result.stderr}`);
    assert.equal(result.stdout.trim(), "99");
  });

  it("accesses DOM after navigation", async () => {
    await navigateTab(fixture.tab, fixture.serverUrl);

    const result = await execScript("eval.js", [
      "document.title",
      "--target",
      fixture.tab,
    ]);
    assert.equal(result.exitCode, 0, `eval.js failed: ${result.stderr}`);
    assert.equal(result.stdout.trim(), "Eval Page");
  });

  it("reads from --stdin", async () => {
    const result = await execScript(
      "eval.js",
      ["--stdin", "--target", fixture.tab],
      {
        stdin: "1+1",
      },
    );
    assert.equal(
      result.exitCode,
      0,
      `eval.js --stdin failed: ${result.stderr}`,
    );
    assert.equal(result.stdout.trim(), "2");
  });

  it("syntax error exits non-zero", async () => {
    const result = await execScript("eval.js", [
      "{{{{",
      "--target",
      fixture.tab,
    ]);
    assert.notEqual(result.exitCode, 0);
  });
});
