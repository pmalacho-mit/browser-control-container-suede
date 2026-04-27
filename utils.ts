import { waitForWsEndpoint } from "./common.js";
import {
  type Browser,
  CONTAINER_NAME,
  IMAGE_TAG,
  RELEASE_DIR,
} from "./config.js";
import { container, docker, image } from "./programmatic-docker-suede";
import { devcontainerNetwork } from "./programmatic-docker-suede/devcontainer.js";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const buildAndRun = async (browser: Browser) => {
  const name = CONTAINER_NAME(browser);
  const tag = IMAGE_TAG(browser);

  try {
    await container.remove(name);
  } catch {}

  console.log(`Building image ${tag} from ${RELEASE_DIR}...`);

  const build = await image
    .build(tag, RELEASE_DIR, { buildargs: { BROWSER: browser } })
    .complete();

  console.log(`Build complete for ${tag}, output:\n${build.out}`);

  if (build.exit !== 0)
    throw new Error(`Build failed for ${tag} with error:\n${build.err}`);

  const network = await devcontainerNetwork();

  console.log(`Starting container ${name}...`);
  const start = ["bash", "-c", "./scripts/start.ts && tail -f /dev/null"];
  await container.run({ network, image: tag, name, command: start });
};

export const buildRunReady = async (browser: Browser) => {
  await buildAndRun(browser);
  console.log(`Waiting for Playwright endpoint for ${browser}...`);
  try {
    await waitForWsEndpoint(CONTAINER_NAME(browser));
  } catch {
    console.error(`Playwright WS endpoint not ready for ${browser}`);
    try {
      const { stdout } = await docker(["logs", CONTAINER_NAME(browser)]);
      console.error(stdout);
    } catch {
      // best effort
    }
  }
};
