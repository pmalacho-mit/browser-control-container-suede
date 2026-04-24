import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execScript, scriptTestFixture, withWatcher } from "./common.js";

describe("watch.js", () => {
  const fixture = scriptTestFixture({
    title: "Watch Test",
    body: `<script>/* console.log called by eval later */</script>`,
    navigateInitialTab: true,
  });

  it("starts without error", async () => {
    const { stderr } = await withWatcher(fixture.tab, async () => {
      // do nothing — just verify it starts
    });
    // stderr may contain the "Watching tab" message, but shouldn't contain "failed"
    assert.ok(
      !stderr.includes("watch failed"),
      `watch.js had error output: ${stderr}`,
    );
  });

  it("console events appear in log", async () => {
    const { logLines } = await withWatcher(fixture.tab, async () => {
      await execScript("eval.js", [
        'console.log("sentinel-value-abc")',
        "--target",
        fixture.tab,
      ]);
    });

    const consoleEntries = logLines
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter((e) => e && e.kind === "console");

    const found = consoleEntries.some(
      (e: any) => e.text && e.text.includes("sentinel-value-abc"),
    );
    assert.ok(
      found,
      `Expected to find "sentinel-value-abc" in console log entries. Entries: ${JSON.stringify(consoleEntries)}`,
    );
  });

  it("network events appear in log", async () => {
    const { logLines } = await withWatcher(fixture.tab, async () => {
      await execScript("eval.js", [
        'fetch("/ping").catch(() => {})',
        "--target",
        fixture.tab,
      ]);
    });

    const netEntries = logLines
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(
        (e) => e && typeof e.kind === "string" && e.kind.startsWith("net:"),
      );

    assert.ok(
      netEntries.length > 0,
      `Expected at least one net:* entry. Lines: ${JSON.stringify(logLines)}`,
    );
  });

  it("JS errors are captured", async () => {
    const { logLines } = await withWatcher(fixture.tab, async () => {
      // This will throw a ReferenceError
      await execScript("eval.js", [
        "undefinedVariable12345.x",
        "--target",
        fixture.tab,
      ]);
    });

    const errorEntries = logLines
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter((e) => e && e.kind === "error");

    assert.ok(
      errorEntries.length > 0,
      `Expected at least one error entry. Lines: ${JSON.stringify(logLines)}`,
    );
  });
});
