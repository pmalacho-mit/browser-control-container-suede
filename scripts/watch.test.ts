import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runPlaywright, createFixture } from "../common.js";

describe("playwright-cli devtools helpers", () => {
  const fixture = fixture({
    title: "Helpers Test",
    body: `<button id="action">Action</button><div id="output"></div>`,
    navigateInitialTab: true,
  });

  it("highlight and hide both succeed", async () => {
    const highlight = await runPlaywright(["highlight", "#action"], {
      session: fixture.session,
    });
    assert.equal(highlight.exit, 0, highlight.err);

    const hide = await runPlaywright(["highlight", "#action", "--hide"], {
      session: fixture.session,
    });
    assert.equal(hide.exit, 0, hide.err);
  });

  it("generate-locator emits a locator for an element", async () => {
    const locator = await runPlaywright(["generate-locator", "#action"], {
      session: fixture.session,
      raw: true,
    });
    assert.equal(locator.exit, 0, locator.err);
    assert.ok(locator.out.trim().length > 0, "Expected locator output");
  });

  it("run-code can update the page for later commands", async () => {
    const code = await runPlaywright(
      [
        "run-code",
        "async page => { await page.locator('#output').evaluate(el => el.textContent = 'updated'); }",
      ],
      { session: fixture.session },
    );
    assert.equal(code.exit, 0, code.err);

    const snapshot = await runPlaywright(["snapshot"], {
      session: fixture.session,
    });
    assert.match(snapshot.out, /updated/);
  });
});
