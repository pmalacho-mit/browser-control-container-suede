import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { container } from "../suede/programmatic-docker-suede/index.js";
import { CONTAINER_NAME } from "../config.js";
import { execScript, fetchCdpVersion, scriptTestFixture } from "../common.js";

describe("start.js", () => {
  const fixture = scriptTestFixture({
    title: "Browser Control Test",
    body: "<p>Hello</p>",
  });

  it("container is running", async () => {
    const running = await container.isRunning(CONTAINER_NAME);
    assert.equal(running, true);
  });

  it("CDP /json/version responds with Chromium", async () => {
    const body = await fetchCdpVersion();
    assert.ok(
      body.Browser?.toLowerCase().includes("chrom"),
      `Expected Browser to contain "chrom", got: ${body.Browser}`,
    );
  });

  it("Chrome can reach a server in the devcontainer", async () => {
    const nav = await execScript("nav.ts", [
      fixture.serverUrl,
      "--target",
      fixture.tab,
    ]).complete();
    assert.equal(nav.exit, 0, `nav.js failed: ${nav.err}`);

    const evalResult = await execScript("eval.ts", [
      "document.title",
      "--target",
      fixture.tab,
    ]).complete();

    assert.equal(evalResult.exit, 0, `eval.ts failed: ${evalResult.err}`);
    assert.equal(evalResult.out.trim(), "Browser Control Test");
  });
});
