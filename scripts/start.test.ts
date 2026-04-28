import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { container } from "../programmatic-docker-suede/index.js";
import defaults from "../release/defaults.js";
import { runPlaywright, createFixture } from "../common.js";

describe("playwright-cli startup", () => {
  const fixture = fixture({
    title: "Browser Control Test",
    body: "<p>Hello</p>",
  });

  it("chromium release container is running", async () => {
    const running = await container.isRunning(defaults.container("chromium"));
    assert.equal(running, true);
  });

  it("playwright-cli is available on PATH", async () => {
    const help = await runPlaywright(["--help"]);
    assert.equal(help.exit, 0, help.err);
    assert.match(help.out, /Usage: playwright-cli/);
  });

  it("browser session can reach a server in the devcontainer", async () => {
    const goto = await runPlaywright(["goto", fixture.serverUrl], {
      session: fixture.session,
    });
    assert.equal(goto.exit, 0, goto.err);

    const snapshot = await runPlaywright(["snapshot"], {
      session: fixture.session,
    });
    assert.equal(snapshot.exit, 0, snapshot.err);
    assert.match(snapshot.out, /Browser Control Test/);
    assert.match(snapshot.out, /Hello/);
  });
});
