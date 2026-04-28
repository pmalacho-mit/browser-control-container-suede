import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile, runPlaywright, createFixture } from "../common.js";

describe("playwright-cli screenshot", () => {
  const fixture = fixture({
    title: "Screenshot Test",
    body: `<main style="width: 640px; height: 320px; background: linear-gradient(90deg, #004, #0aa); color: white; display: grid; place-items: center; font-size: 48px;">
        Screenshot Target
      </main>`,
    navigateInitialTab: true,
  });

  it("writes a viewport screenshot to a custom file", async () => {
    const path = `/tmp/viewport-${process.pid}.png`;
    const shot = await runPlaywright(["screenshot", `--filename=${path}`], {
      session: fixture.session,
    });
    assert.equal(shot.exit, 0, shot.err);

    const file = await readFile(path);
    assert.equal(file.exit, 0, String(file.err));
    assert.deepEqual(
      file.out.subarray(0, 8),
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  it("writes an element screenshot to a custom file", async () => {
    const path = `/tmp/element-${process.pid}.png`;
    const shot = await runPlaywright(
      ["screenshot", "main", `--filename=${path}`],
      { session: fixture.session },
    );
    assert.equal(shot.exit, 0, shot.err);

    const file = await readFile(path);
    assert.equal(file.exit, 0, String(file.err));
    assert.ok(file.out.length > 1000, "Expected non-trivial png size");
  });
});
