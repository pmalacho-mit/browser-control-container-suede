import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import devcontainer from "./browser-control-container-suede.programmatic-docker-suede/devcontainer.js";
import { type Authority, authority } from "./certificate-authority.js";
import { startTestServer } from "./common.js";
import { certificates } from "./release/certificates.js";
import defaults from "./release/defaults.js";
import { browsers, playwright } from "./release/index.js";

const page = "<!DOCTYPE html><html><head><title>Secured</title></head><body>ok</body></html>";

const errored = (out: string) => out.startsWith("### Error");

describe("top-level: certificates", { concurrency: true }, () => {
  test("local() reports roots this machine trusts, and nothing else", async () => {
    const paths = await certificates.local();
    assert.ok(Array.isArray(paths));
    for (const path of paths) {
      assert.match(path, /\.(crt|pem)$/i);
      assert.ok(existsSync(path), `${path} does not exist`);
    }
  });

  for (const browser of browsers)
    describe(`${browser} tests`, { concurrency: 1 }, () => {
      const container = defaults.container(browser);
      let server: Awaited<ReturnType<typeof startTestServer>> | undefined;
      let ca: Authority | undefined;
      let session: string | undefined;

      /**
       * A fresh authority every run, trusted by nothing until it is installed.
       * That is what lets the first test below be a real negative control
       * rather than a claim about what the base image happens to carry.
       */
      before(async () => {
        await playwright.ready(container);
        ca = await authority(devcontainer.ip());
        server = await startTestServer(page, ca.server);
      });

      beforeEach(async () => {
        session = `certificates-${browser}-${process.pid}`;
        await playwright.open(container, browser, session);
      });

      afterEach(async () => {
        if (session) await playwright.close(container, session).catch(() => {});
        session = undefined;
      });

      after(async () => {
        await server?.close();
        await ca?.dispose();
      });

      /**
       * Installing cannot be undone for this container, so the negative
       * control has to come first. The enclosing `describe` runs its tests one
       * at a time, in order.
       */
      test("an authority the container does not know is rejected", async () => {
        const { out } = await playwright.run(
          container,
          ["goto", server!.url],
          { session },
        );
        assert.ok(
          errored(out),
          `expected ${browser} to reject the certificate, got:\n${out}`,
        );
      });

      test("installing the authority makes the page load", async () => {
        await certificates.install(container, [ca!.path]);

        const { out } = await playwright.run(
          container,
          ["goto", server!.url],
          { session },
        );
        assert.ok(!errored(out), `navigation failed:\n${out}`);

        assert.equal(
          await playwright.evaluate(container, () => document.title, session),
          "Secured",
        );
      });

      test("installing the same authority again is harmless", async () => {
        await certificates.install(container, [ca!.path, ca!.path]);

        const { out } = await playwright.run(
          container,
          ["goto", server!.url],
          { session },
        );
        assert.ok(!errored(out), `navigation failed:\n${out}`);
      });
    });
});
