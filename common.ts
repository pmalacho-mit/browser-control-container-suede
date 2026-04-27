import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { Socket } from "node:net";
import { before, after } from "node:test";
import { getDevcontainerIp } from "./suede/programmatic-docker-suede/devcontainer.js";
import { container } from "./suede/programmatic-docker-suede";
import { CONTAINER_NAME } from "./config.js";
import { sleep } from "./utils.js";

export type BrowserRuntimeInfo = {
  Browser?: string;
  "Protocol-Version"?: string;
  "User-Agent"?: string;
  "V8-Version"?: string;
  "WebKit-Version"?: string;
  webSocketDebuggerUrl?: string;
};

export type BrowserPage = {
  id: string;
  type: string;
  webSocketDebuggerUrl?: string;
};

/** Legacy compatibility alias. */
export type CdpVersionInfo = BrowserRuntimeInfo;
/** Legacy compatibility alias. */
export type CdpTarget = BrowserPage;

const CHROMIUM = CONTAINER_NAME("chromium");
const TAB_INDEX_LINE = /^\s*\[(\d+)\]\s*$/gm;

const parseTabIndices = (output: string): string[] => {
  const matches = output.matchAll(TAB_INDEX_LINE);
  return [...matches].map((match) => match[1]);
};

const listPageIndices = async (): Promise<string[]> => {
  const tabs = await execScript("tabs.ts").complete();
  if (tabs.exit !== 0)
    throw new Error(`tabs.ts failed while listing pages: ${tabs.err}`);
  const parsed = parseTabIndices(tabs.out);
  // getPage() auto-creates target 0 when no pages currently exist.
  return parsed.length > 0 ? parsed : ["0"];
};

/**
 * Returns generic browser runtime info and confirms the Playwright endpoint is usable.
 */
export const fetchBrowserVersion = async (): Promise<BrowserRuntimeInfo> => {
  await waitForPlaywright();
  return {
    Browser: `playwright-${process.env.BROWSER ?? "chromium"}`,
    "Protocol-Version": "playwright-ws",
  };
};

/** Back-compat alias for older tests. */
export const fetchCdpVersion = fetchBrowserVersion;

/**
 * List open pages using Playwright tab indices.
 */
export const fetchBrowserTargets = async (): Promise<BrowserPage[]> => {
  const indices = await listPageIndices();
  return indices.map((id) => ({ id, type: "page" }));
};

/** Back-compat alias for older tests. */
export const fetchCdpTargets = fetchBrowserTargets;

/**
 * Polls Playwright endpoint readiness.
 * Throws after maxAttempts x delayMs if not ready.
 */
export async function waitForReady(
  maxAttempts: number = 20,
  delayMs: number = 250,
): Promise<void> {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      await waitForWsEndpoint(CHROMIUM, 1, delayMs);
      const tabs = await execScript("tabs.ts").complete();
      if (tabs.exit === 0) return;
    } catch {
      // not ready yet
    }
    if (i < maxAttempts) await sleep(delayMs);
  }
  throw new Error("Playwright endpoint not ready after polling");
}

/** Semantic alias emphasizing Playwright readiness. */
export const waitForPlaywright = waitForReady;

/**
 * Polls /tmp/playwright-ws inside a container until the Playwright WS endpoint
 * has been written by server.ts. Throws after maxAttempts x delayMs if not ready.
 */
export async function waitForWsEndpoint(
  containerName: string,
  maxAttempts: number = 40,
  delayMs: number = 500,
): Promise<void> {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const { out } = await container
        .exec(containerName, ["cat", "/tmp/playwright-ws"])
        .complete();
      if (out.trim().startsWith("ws://")) return;
    } catch {
      // not ready yet
    }
    if (i < maxAttempts) await sleep(delayMs);
  }
  throw new Error(
    `Playwright WS endpoint not ready in container ${containerName}`,
  );
}

/**
 * Closes all extra tabs (keeps the first tab) using tabs.ts.
 */
export async function closeAllTabs(): Promise<void> {
  try {
    await execScript("tabs.ts", ["--close-all"]).complete();
  } catch {
    // best effort
  }
}

/**
 * Create a new page and return its index id.
 * @param url - Optional URL to navigate to immediately.
 */
export async function createPage(
  url?: string,
): Promise<{ id: string; wsUrl: string }> {
  const nav = await execScript("nav.ts", [
    url ?? "about:blank",
    "--new",
  ]).complete();
  if (nav.exit !== 0) throw new Error(`nav.ts --new failed: ${nav.err}`);

  return { id: "0", wsUrl: "" };
}

/** Back-compat alias for older tests that still call createTab(). */
export const createTab = createPage;

/**
 * Close a specific page by index.
 * @param id - Page index to close.
 */
export const closePage = async (id: string) =>
  execScript("tabs.ts", ["--close", id]).complete();

/** Back-compat alias for older tests. */
export const closeTab = closePage;

/**
 * Execute a script inside the test container via docker exec.
 * Does NOT throw on non-zero exit - lets tests assert exit codes explicitly.
 */
export const execScript = (script: string, args: string[] = []) =>
  container.exec(CHROMIUM, [`/app/scripts/${script}`, ...args]);

type RequestHandler = (req: IncomingMessage, res: ServerResponse) => void;

/**
 * Start a test HTTP server bound to the devcontainer IP (reachable from the browser container).
 * @param handler - Either an HTML string (served for all requests) or a raw (req, res) handler.
 */
export async function startTestServer(
  handler: string | RequestHandler,
): Promise<{ url: string; port: number; close: () => Promise<void> }> {
  const ip = getDevcontainerIp();

  const requestHandler: RequestHandler =
    typeof handler === "string"
      ? (_, response) => {
          response.writeHead(200, { "Content-Type": "text/html" });
          response.end(handler);
        }
      : handler;

  const server = createServer(requestHandler);
  const sockets = new Set<Socket>();

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, ip, () => resolve());
  });

  const addr = server.address();
  if (!addr || typeof addr === "string")
    throw new Error("Could not determine server address");

  const port = addr.port;
  const url = `http://${ip}:${port}`;

  return {
    url,
    port,
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}

/**
 * Navigate a page to a URL using nav.ts and wait for it to load.
 */
export const navigatePage = (target: string, url: string) =>
  execScript("nav.ts", [url, "--target", target]);

/** Back-compat alias for older tests. */
export const navigateTab = navigatePage;

/**
 * Evaluate an expression in a specific page via eval.ts.
 */
export const evalPage = (target: string, expression: string) =>
  execScript("eval.ts", [expression, "--target", target]);

/** Back-compat alias for older tests. */
export const evalTab = evalPage;

const shellEscapeSingle = (value: string) =>
  `'${value.replace(/'/g, `'"'"'`)}'`;

/**
 * Start watch.ts as a background daemon inside the container, run a callback,
 * then kill the watcher and return the log file contents.
 */
export async function withWatcher(
  target: string,
  work: () => Promise<void>,
): Promise<{ logLines: string[]; stderr: string }> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const stdoutPath = `/tmp/watch-stdout-${suffix}.log`;
  const stderrPath = `/tmp/watch-stderr-${suffix}.log`;
  const targetArg = shellEscapeSingle(String(target));

  const startResult = await container
    .exec(CHROMIUM, [
      "bash",
      "-lc",
      `/app/scripts/watch.ts --target ${targetArg} > ${stdoutPath} 2> ${stderrPath} & echo $!`,
    ])
    .complete();

  const pid = startResult.out.trim().split(/\s+/).at(-1);
  if (!pid) throw new Error("Failed to start watcher process");

  await sleep(800);
  await work();
  await sleep(800);

  await container
    .exec(CHROMIUM, ["bash", "-lc", `kill ${pid} 2>/dev/null || true`])
    .complete();
  await sleep(250);

  const findResult = await container
    .exec(CHROMIUM, [
      "bash",
      "-lc",
      `find /tmp/browser-logs -name ${shellEscapeSingle(`${target}.jsonl`)} -type f | sort | tail -1`,
    ])
    .complete();
  const logFile = findResult.out.trim();

  let logLines: string[] = [];
  if (logFile) {
    const catResult = await container
      .exec(CHROMIUM, ["cat", logFile])
      .complete();
    if (catResult.exit === 0)
      logLines = catResult.out
        .split("\n")
        .filter((line) => line.trim().length > 0);
  }

  const stderrResult = await container
    .exec(CHROMIUM, ["cat", stderrPath])
    .complete();

  return { logLines, stderr: stderrResult.out };
}

/**
 * Register before/after hooks for script tests with a scoped server and target list.
 */
export const scriptTestFixture = ({
  /** HTML <title> used for the fixture page. */
  title,
  /** HTML inserted into <body> for the fixture page. */
  body,
  /** Number of pages to create during setup. Defaults to 1. */
  initialTabs = 1,
  /** Navigate the first page to the fixture server URL during setup. */
  navigateInitialTab = false,
}: {
  title: string;
  body: string;
  initialTabs?: number;
  navigateInitialTab?: boolean;
}) => {
  let server: Awaited<ReturnType<typeof startTestServer>> | undefined;
  let targets: string[] | undefined;

  before(async () => {
    await waitForPlaywright();
    server = await startTestServer(
      `<!DOCTYPE html><html><head><title>${title}</title></head><body>${body}</body></html>`,
    );

    if (initialTabs > 0) {
      targets = [];
      for (let i = 0; i < initialTabs; i++)
        targets.push((await createPage()).id);
      if (navigateInitialTab)
        await navigatePage(targets[0], server.url).complete();
    } else if (navigateInitialTab) {
      throw new Error("navigateInitialTab requires at least one initial tab");
    }
  });

  after(async () => {
    if (targets) {
      const ordered = [...targets]
        .map((target) => Number(target))
        .filter((target) => Number.isFinite(target))
        .sort((a, b) => b - a);
      for (const target of ordered)
        await closePage(String(target)).catch(() => {});
    }

    targets = undefined;
    await server?.close();
  });

  return {
    /** Primary target helper for tests that only need one page index. */
    get tab() {
      if (!targets) throw new Error("Test fixture targets not initialized yet");
      if (targets.length === 0)
        throw new Error("No targets available in fixture");
      return targets[0];
    },
    /** Full mutable target list so tests can track extra pages they create. */
    get tabs(): string[] {
      if (!targets) throw new Error("Test fixture targets not initialized yet");
      return targets;
    },
    /** Fixture server URL for navigation assertions. */
    get serverUrl() {
      if (!server) throw new Error("Test fixture server not initialized yet");
      return server.url;
    },
  };
};
