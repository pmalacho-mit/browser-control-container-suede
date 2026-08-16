import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { container } from "./browser-control-container-suede.programmatic-docker-suede";
import devcontainer from "./browser-control-container-suede.programmatic-docker-suede/devcontainer.js";
import { startTestServer } from "./common.js";
import { encode } from "./release/forward.js";
import { browsers, buildAndRun, playwright } from "./release/index.js";

const page =
  "<!DOCTYPE html><html><head><title>Forwarded</title></head><body>ok</body></html>";

describe("top-level: port forwarding", { concurrency: true }, () => {
  describe("encoding", { concurrency: 1 }, () => {
    test("a bare port keeps its number on both sides", async () => {
      assert.equal(
        await encode([{ port: 5173, host: "example.internal" }]),
        "5173:example.internal:5173",
      );
    });

    test("a target changes the port on the way", async () => {
      assert.equal(
        await encode([{ port: 8080, host: "api.internal", target: 80 }]),
        "8080:api.internal:80",
      );
    });

    test("forwarding nothing encodes to nothing", async () => {
      assert.equal(await encode([]), "");
    });

    test("an unnamed host resolves to the devcontainer", async () => {
      assert.equal(
        await encode([5173]),
        `5173:${await devcontainer.ip.inspect()}:5173`,
      );
    });
  });

  for (const browser of browsers)
    describe(`${browser} tests`, { concurrency: 1 }, () => {
      const name = `browser-control-forward-${browser}`;
      const session = `forward-${browser}-${process.pid}`;
      let server: Awaited<ReturnType<typeof startTestServer>> | undefined;

      /**
       * Its own container, because what a container forwards is fixed when it
       * starts, and the port to forward is only known once the server has one.
       */
      before(async () => {
        server = await startTestServer(page);
        await buildAndRun(browser, {
          container: () => name,
          forward: [server.port],
        });
        await playwright.ready(name);
        await playwright.open(name, browser, session);
      });

      after(async () => {
        await playwright.close(name, session).catch(() => {});
        await container.tryRemove(name);
        await server?.close();
      });

      const goto = async (url: string) => {
        const { out } = await playwright.run(name, ["goto", url], { session });
        assert.ok(!out.startsWith("### Error"), `navigation failed:\n${out}`);
      };

      test("the devcontainer's server answers on the browser's loopback address", async () => {
        await goto(`http://localhost:${server!.port}/`);
        assert.equal(
          await playwright.evaluate(name, () => document.title, session),
          "Forwarded",
        );
      });

      test("the forwarded origin is trustworthy where the direct one is not", async () => {
        const secure = () =>
          playwright.evaluate(name, () => window.isSecureContext, session);

        await goto(`http://localhost:${server!.port}/`);
        assert.equal(await secure(), true);

        await goto(server!.url);
        assert.equal(await secure(), false);
      });
    });

  /**
   * Reuse is about the container's configuration rather than the browser in
   * it, so one browser is enough to cover it.
   */
  describe("reuse", { concurrency: 1 }, () => {
    const name = "browser-control-forward-reuse";
    let server: Awaited<ReturnType<typeof startTestServer>> | undefined;

    before(async () => {
      server = await startTestServer(page);
    });

    after(async () => {
      await container.tryRemove(name);
      await server?.close();
    });

    const run = (forward: number[], skipIfRunning?: boolean) =>
      buildAndRun("chromium", { container: () => name, forward, skipIfRunning });

    test("a container already forwarding the same ports is reused", async () => {
      const first = await run([server!.port]);
      const again = await run([server!.port], true);
      assert.equal(again.id, first.id);
    });

    test("a container forwarding something else is replaced", async () => {
      const first = await run([server!.port]);
      const replaced = await run([server!.port + 1], true);
      assert.notEqual(replaced.id, first.id);
    });
  });
});
