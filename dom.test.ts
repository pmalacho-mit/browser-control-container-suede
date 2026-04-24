import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execScript, scriptTestFixture } from "./common.js";

describe("dom.js", () => {
  const fixture = scriptTestFixture({
    title: "DOM Test",
    body: `<h1>Main Heading</h1>
      <a href="/x">Test Link</a>
      <input type="text" id="myinput" placeholder="enter text" />
      <p>visible text here</p>`,
    navigateInitialTab: true,
  });

  it("default outline contains page info", async () => {
    const dom = await execScript("dom.js", ["--target", fixture.tab]);
    assert.equal(dom.exitCode, 0, `dom.js failed: ${dom.stderr}`);
    assert.ok(
      dom.stdout.includes("DOM Test"),
      `Expected stdout to contain title, got: ${dom.stdout}`,
    );
    assert.ok(
      dom.stdout.includes("Main Heading"),
      `Expected stdout to contain heading text, got: ${dom.stdout}`,
    );
  });

  it("scoped to selector shows matching HTML", async () => {
    const dom = await execScript("dom.js", ["h1", "--target", fixture.tab]);
    assert.equal(dom.exitCode, 0, `dom.js 'h1' failed: ${dom.stderr}`);
    assert.ok(
      dom.stdout.includes("Main Heading"),
      `Expected stdout to contain h1 content, got: ${dom.stdout}`,
    );
  });

  it("--links lists page links", async () => {
    const dom = await execScript("dom.js", [
      "--links",
      "--target",
      fixture.tab,
    ]);
    assert.equal(dom.exitCode, 0, `dom.js --links failed: ${dom.stderr}`);
    assert.ok(
      dom.stdout.includes("/x"),
      `Expected stdout to contain /x, got: ${dom.stdout}`,
    );
  });

  it("--inputs lists interactive elements", async () => {
    const dom = await execScript("dom.js", [
      "--inputs",
      "--target",
      fixture.tab,
    ]);
    assert.equal(dom.exitCode, 0, `dom.js --inputs failed: ${dom.stderr}`);
    assert.ok(
      dom.stdout.toLowerCase().includes("input"),
      `Expected stdout to mention input, got: ${dom.stdout}`,
    );
  });

  it("--text extracts visible text", async () => {
    const dom = await execScript("dom.js", [
      "--text",
      "body",
      "--target",
      fixture.tab,
    ]);
    assert.equal(dom.exitCode, 0, `dom.js --text failed: ${dom.stderr}`);
    assert.ok(
      dom.stdout.includes("visible text here"),
      `Expected stdout to contain "visible text here", got: ${dom.stdout}`,
    );
  });
});
