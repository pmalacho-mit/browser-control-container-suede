import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runPlaywright, createFixture } from "../common.js";
import { sleep } from "../utils.js";

describe("playwright-cli console logs", () => {
  const fixture = fixture({
    title: "Console Test",
    body: `<script>
      console.log('console-info-message');
      console.warn('console-warning-message');
      console.error('console-error-message');
    </script>`,
    navigateInitialTab: true,
  });

  it("console lists emitted messages", async () => {
    await sleep(250);
    const logs = await runPlaywright(["console"], { session: fixture.session });
    assert.equal(logs.exit, 0, logs.err);
    assert.match(logs.out, /console-info-message/);
    assert.match(logs.out, /console-warning-message/);
    assert.match(logs.out, /console-error-message/);
  });

  it("console warning filter excludes info logs", async () => {
    await sleep(250);
    const logs = await runPlaywright(["console", "warning"], {
      session: fixture.session,
    });
    assert.equal(logs.exit, 0, logs.err);
    assert.match(logs.out, /console-warning-message|console-error-message/);
    assert.doesNotMatch(logs.out, /console-info-message/);
  });
});
