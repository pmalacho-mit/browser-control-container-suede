import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { docker } from "./suede/programmatic-docker-suede";
import {
  waitForReady,
  closeTab,
  createTab,
  execScript,
  navigateTab,
  startTestServer,
} from "./common.js";
import { CONTAINER_NAME } from "./config.js";

describe("screenshot.js", () => {
  let tabId: string;
  let server: Awaited<ReturnType<typeof startTestServer>>;
  // A baseline screenshot taken during setup, used for pixel comparison in test 3.
  let referencePng: InstanceType<typeof PNG>;

  before(async () => {
    await waitForReady();

    // Download a reference image
    const imgRes = await fetch("https://picsum.photos/800/600");
    const referenceBuffer = Buffer.from(await imgRes.arrayBuffer());

    // Encode as data URI
    const dataUri = `data:image/jpeg;base64,${referenceBuffer.toString("base64")}`;

    server = await startTestServer(
      `<!DOCTYPE html><html><head><title>Screenshot Test</title></head>
      <body style="margin:0;padding:0">
        <img src="${dataUri}" style="width:800px;height:600px;display:block" />
      </body></html>`,
    );

    const tab = await createTab();
    tabId = tab.id;
    await navigateTab(tabId, server.url);

    // Wait for the image to render
    await new Promise((r) => setTimeout(r, 1000));

    // Capture a baseline screenshot to use as the pixelmatch reference in test 3.
    const baseShot = await execScript("screenshot.js", ["--target", tabId]);
    if (baseShot.exitCode === 0) {
      const baseCat = await docker.execWithBufferResult(CONTAINER_NAME, [
        "cat",
        baseShot.stdout.trim(),
      ]);
      if (baseCat.exitCode === 0) referencePng = PNG.sync.read(baseCat.stdout);
    }
  });

  after(async () => {
    await closeTab(tabId);
    await server?.close();
  });

  it("default viewport PNG returns a file path", async () => {
    const shot = await execScript("screenshot.js", ["--target", tabId]);
    assert.equal(shot.exitCode, 0, `screenshot.js failed: ${shot.stderr}`);
    const outPath = shot.stdout.trim();
    assert.ok(
      outPath.endsWith(".png"),
      `Expected path ending .png, got: ${outPath}`,
    );
  });

  it("PNG bytes are valid", async () => {
    const shot = await execScript("screenshot.js", ["--target", tabId]);
    assert.equal(shot.exitCode, 0);
    const outPath = shot.stdout.trim();

    const catResult = await docker.execWithBufferResult(CONTAINER_NAME, [
      "cat",
      outPath,
    ]);
    assert.equal(catResult.exitCode, 0, `cat failed: ${catResult.stderr}`);

    // PNG magic bytes: 0x89 P N G \r \n 0x1a \n
    const magic = catResult.stdout.subarray(0, 8);
    const expected = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    assert.deepEqual(magic, expected, "First 8 bytes should be PNG magic");
  });

  it("image content roughly matches reference", async () => {
    assert.ok(referencePng, "Baseline screenshot was not captured in before()");

    const shot = await execScript("screenshot.js", ["--target", tabId]);
    assert.equal(shot.exitCode, 0);
    const outPath = shot.stdout.trim();

    const catResult = await docker.execWithBufferResult(CONTAINER_NAME, [
      "cat",
      outPath,
    ]);
    assert.equal(catResult.exitCode, 0);

    const screenshotPng = PNG.sync.read(catResult.stdout);

    assert.equal(
      screenshotPng.width,
      referencePng.width,
      "Screenshot width should match baseline",
    );
    assert.equal(
      screenshotPng.height,
      referencePng.height,
      "Screenshot height should match baseline",
    );

    // Compare pixel-by-pixel against the baseline screenshot of the same page.
    // A freshly rendered identical page should produce ≤10% pixel difference.
    const mismatch = pixelmatch(
      referencePng.data,
      screenshotPng.data,
      undefined,
      screenshotPng.width,
      screenshotPng.height,
      { threshold: 0.1 },
    );
    const ratio = mismatch / (screenshotPng.width * screenshotPng.height);
    assert.ok(
      ratio <= 0.1,
      `Pixel mismatch ratio ${(ratio * 100).toFixed(2)}% exceeds 10% threshold`,
    );
  });

  it("--full flag works", async () => {
    const shot = await execScript("screenshot.js", [
      "--full",
      "--target",
      tabId,
    ]);
    assert.equal(
      shot.exitCode,
      0,
      `screenshot.js --full failed: ${shot.stderr}`,
    );
    const outPath = shot.stdout.trim();
    assert.ok(outPath.endsWith(".png"));
  });

  it("custom output path with -o", async () => {
    const customPath = "/tmp/test-screenshot.png";
    const shot = await execScript("screenshot.js", [
      "-o",
      customPath,
      "--target",
      tabId,
    ]);
    assert.equal(shot.exitCode, 0, `screenshot.js -o failed: ${shot.stderr}`);

    const ls = await docker.execWithBufferResult(CONTAINER_NAME, [
      "ls",
      customPath,
    ]);
    assert.equal(ls.exitCode, 0, `File not found at ${customPath}`);
  });
});
