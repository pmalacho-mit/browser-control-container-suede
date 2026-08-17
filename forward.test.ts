import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { container } from "./browser-control-container-suede.programmatic-docker-suede";
import devcontainer from "./browser-control-container-suede.programmatic-docker-suede/devcontainer.js";
import { type Authority, authority } from "./certificate-authority.js";
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

    /**
     * Rejected here rather than in the container, where binding the same port
     * twice would only show up as a line in `docker logs`.
     */
    test("the same port cannot be forwarded twice", async () => {
      await assert.rejects(
        () => encode([5173, { port: 5173, host: "elsewhere.internal" }]),
        /same port twice: 5173/,
      );
    });

    /** `<port>:<host>:<port>` cannot survive a colon in the host. */
    test("an IPv6 literal host is rejected rather than mangled", async () => {
      await assert.rejects(
        () => encode([{ port: 5173, host: "::1" }]),
        /IPv6 literal/,
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
   * The two features together, which is the path a consumer actually takes: an
   * `https` dev server in the devcontainer, reached through a forward so the
   * origin is trustworthy, signed by an authority installed through
   * `trustCertificates`.
   *
   * Nothing else covers this. The tests above forward plain `http`, and
   * `certificates.test.ts` serves `https` with no forward. It is also the only
   * test of `trustCertificates`, as opposed to calling `certificates.install`
   * directly.
   *
   * A forward is a TCP pipe rather than a proxy, so the browser handshakes
   * against the upstream using `localhost` as the name: loading at all proves
   * both that the authority is trusted and that the leaf covers `localhost`.
   *
   * Serial, because each browser needs its own container and starting several
   * at once is a lot to ask of the daemon at the same moment.
   */
  describe("https over a forward", { concurrency: 1 }, () => {
    for (const browser of browsers)
      describe(`${browser} tests`, { concurrency: 1 }, () => {
        const name = `browser-control-forward-secure-${browser}`;
        const session = `forward-secure-${browser}-${process.pid}`;
        let server: Awaited<ReturnType<typeof startTestServer>> | undefined;
        let ca: Authority | undefined;

        before(async () => {
          ca = await authority(
            devcontainer.ip(),
            await devcontainer.ip.inspect(),
          );
          server = await startTestServer(page, ca.server);
          await buildAndRun(browser, {
            container: () => name,
            forward: [server.port],
            trustCertificates: [ca.path],
          });
          await playwright.ready(name);
          await playwright.open(name, browser, session);
        });

        after(async () => {
          await playwright.close(name, session).catch(() => {});
          await container.tryRemove(name);
          await server?.close();
          await ca?.dispose();
        });

        test("the forwarded https origin loads and is trustworthy", async () => {
          const { out } = await playwright.run(
            name,
            ["goto", `https://localhost:${server!.port}/`],
            { session },
          );
          assert.ok(!out.startsWith("### Error"), `navigation failed:\n${out}`);

          assert.equal(
            await playwright.evaluate(name, () => document.title, session),
            "Forwarded",
          );
          assert.equal(
            await playwright.evaluate(
              name,
              () => window.isSecureContext,
              session,
            ),
            true,
          );
        });
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
