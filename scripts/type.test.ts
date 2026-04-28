import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runPlaywright, createFixture } from "../common.js";

describe("playwright-cli text input", () => {
  const fixture = fixture({
    title: "Type Test",
    body: `<form onsubmit="localStorage.setItem('submitted', document.querySelector('#inp').value); return false">
        <input id="inp" type="text" oninput="localStorage.setItem('typed', this.value)" />
        <button type="submit">Go</button>
      </form>`,
    navigateInitialTab: true,
  });

  it("fill writes a full value into an input", async () => {
    const fill = await runPlaywright(["fill", "#inp", "hello world"], {
      session: fixture.session,
    });
    assert.equal(fill.exit, 0, fill.err);

    const value = await runPlaywright(["localstorage-get", "typed"], {
      session: fixture.session,
      raw: true,
    });
    assert.equal(value.out.trim(), "hello world");
  });

  it("type appends through the focused editable element", async () => {
    await runPlaywright(["click", "#inp"], { session: fixture.session });

    const type = await runPlaywright(["type", "abc"], {
      session: fixture.session,
    });
    assert.equal(type.exit, 0, type.err);

    const snapshot = await runPlaywright(["snapshot"], {
      session: fixture.session,
    });
    assert.match(snapshot.out, /abc/);
  });

  it("press Enter submits the focused form", async () => {
    await runPlaywright(["fill", "#inp", "submitted"], {
      session: fixture.session,
    });
    await runPlaywright(["click", "#inp"], { session: fixture.session });

    const press = await runPlaywright(["press", "Enter"], {
      session: fixture.session,
    });
    assert.equal(press.exit, 0, press.err);

    const value = await runPlaywright(["localstorage-get", "submitted"], {
      session: fixture.session,
      raw: true,
    });
    assert.equal(value.out.trim(), "submitted");
  });

  it("missing selector exits non-zero", async () => {
    const fill = await runPlaywright(["fill", "#missing", "text"], {
      session: fixture.session,
    });
    assert.notEqual(fill.exit, 0);
  });
});
