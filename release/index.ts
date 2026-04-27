import { resolve } from "node:path";
import { container, image } from "../programmatic-docker-suede";
import { devcontainerNetwork } from "../programmatic-docker-suede/devcontainer.js";
import CommandStream from "../programmatic-docker-suede/CommandStream.js";
import defaults from "./defaults.js";

/**
 * Currently, `chrome` is not supported on Apple Silicon due to Playwright's bundled Chromium not supporting ARM64 Linux.
 * This is supposed to be fixed in Q2 2026: https://blog.google/chromium/bringing-chrome-to-arm64-linux-devices/
 */
export const browsers = [
  "chromium",
  "firefox",
  "webkit",
  /** chrome */
] as const;
export type Browser = (typeof browsers)[number];

const __dirname = resolve(import.meta.dirname);
const context = resolve(__dirname, "docker");

type Options = Partial<
  typeof defaults & {
    onBuild: (stream: CommandStream) => void;
    log?: boolean;
  }
>;

export const tryRemove = async (
  browser: Browser,
  details?: Pick<Options, "container" | "log">,
) => {
  try {
    await container.remove((details?.container ?? defaults.container)(browser));
    if (details?.log) console.log(`Removed existing container for ${browser}`);
  } catch {}
};

/**
 *
 * @param BROWSER
 * @param details
 * @returns
 * @throws
 */
export const buildAndRun = async (BROWSER: Browser, details?: Options) => {
  const name = (details?.container ?? defaults.container)(BROWSER);
  const tag = (details?.image ?? defaults.image)(BROWSER);

  await tryRemove(BROWSER, details);

  if (details?.log) console.log(`Building image ${tag} from ${context}...`);

  const build = await image.build(tag, context, { buildargs: { BROWSER } });

  details?.onBuild?.(build);

  if (details?.log)
    for await (const chunk of build.chunks())
      process[chunk.kind === "err" ? "stderr" : "stdout"].write(chunk.data);

  const { exit, err } = await build.complete();

  if (exit !== 0)
    throw new Error(`Build failed for ${tag} with error:\n${err}`);

  const network = await devcontainerNetwork();

  const command = details?.command ?? defaults.command;
  return container.run({ network, image: tag, name, command });
};
