import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { container } from "./suede/programmatic-docker-suede/index.js";
import { CONTAINER_NAME } from "./config.js";
import { execScript, fetchCdpVersion, scriptTestFixture } from "./common.js";

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
    assert.equal(
      evalResult.exitCode,
      0,
      `eval.js failed: ${evalResult.stderr}`,
    );
    assert.equal(evalResult.stdout.trim(), "Browser Control Test");
  });
});
