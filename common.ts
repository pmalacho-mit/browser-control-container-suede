import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { Socket } from "node:net";
import { before, after } from "node:test";
import { getDevcontainerIp } from "./suede/programmatic-docker-suede/devcontainer.js";
import { docker } from "./suede/programmatic-docker-suede/index.js";
import { CDP_URL, CONTAINER_NAME } from "./config.js";
import { sleep } from "./utils.js";
import { runCmdWithResult } from "./suede/programmatic-docker-suede/exec.js";

export type CdpVersionInfo = {
  Browser?: string;
  "Protocol-Version"?: string;
  "User-Agent"?: string;
  "V8-Version"?: string;
  "WebKit-Version"?: string;
  webSocketDebuggerUrl?: string;
};

export type CdpTarget = {
  id: string;
  type: string;
  webSocketDebuggerUrl?: string;
};

/**
 * Fetch and parse CDP /json/version response.
 */
export const fetchCdpVersion = async (): Promise<CdpVersionInfo> => {
  const res = await fetch(`${CDP_URL}/json/version`);
  if (!res.ok) throw new Error(`CDP /json/version responded ${res.status}`);
  return (await res.json()) as CdpVersionInfo;
};

/**
 * Fetch and parse CDP /json target list.
 */
export const fetchCdpTargets = async (): Promise<CdpTarget[]> => {
  const res = await fetch(`${CDP_URL}/json`);
  if (!res.ok) throw new Error(`CDP /json responded ${res.status}`);
  return (await res.json()) as CdpTarget[];
};

/**
 * Polls CDP_URL until it responds OK.
 * Throws after maxAttempts×delayMs if not ready.
 */
export async function waitForReady(
  maxAttempts: number = 20,
  delayMs: number = 250,
): Promise<void> {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      await fetchCdpVersion();
      return;
    } catch {
      // not ready yet
    }
    if (i < maxAttempts) await sleep(delayMs);
  }
  throw new Error("CDP endpoint not ready after polling");
}

/**
 * Closes all page tabs via the CDP HTTP API.
 */
export async function closeAllTabs(): Promise<void> {
  try {
    const targets = await fetchCdpTargets();
    for (const { type, id } of targets)
      if (type === "page")
        await fetch(`${CDP_URL}/json/close/${id}`).catch(() => {});
  } catch {
    // best effort
  }
}

/**
 * Create a new browser tab via the CDP HTTP API.
 * @param url - Optional URL to navigate to immediately.
 * @returns The target id and webSocketDebuggerUrl.
 */
export async function createTab(
  url?: string,
): Promise<{ id: string; wsUrl: string }> {
  const endpoint = url
    ? `${CDP_URL}/json/new?${encodeURIComponent(url)}`
    : `${CDP_URL}/json/new`;
  const res = await fetch(endpoint, { method: "PUT" });
  const target = (await res.json()) as {
    id: string;
    webSocketDebuggerUrl: string;
  };
  return { id: target.id, wsUrl: target.webSocketDebuggerUrl };
}

/**
 * Close a specific browser tab.
 * @param id - Target id to close.
 */
export const closeTab = async (id: string) =>
  fetch(`${CDP_URL}/json/close/${id}`).catch(() => {});

/**
 * Execute a script inside the test container via `docker exec`.
 * Does NOT throw on non-zero exit — lets tests assert exit codes explicitly.
 */
export const execScript = (
  script: string,
  args: string[] = [],
  options?: { stdin?: string },
) =>
  runCmdWithResult(
    "docker",
    [
      "exec",
      ...(options?.stdin ? ["-i"] : []),
      CONTAINER_NAME,
      `/app/scripts/${script}`,
      ...args,
    ],
    { stdin: options?.stdin },
  );

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
 * Start watch.js as a background daemon inside the container, run a callback,
 * then kill the watcher and return the log file contents.
 *
 * Uses `docker exec` with a PID-based approach: starts watch.js, does work,
 * then kills the process and reads the log.
 */
export async function withWatcher(
  targetId: string,
  work: () => Promise<void>,
): Promise<{ logLines: string[]; stderr: string }> {
  // Start watch.js in background inside the container, capture its PID
  const startResult = await docker.execWithResult(CONTAINER_NAME, [
    "bash",
    "-c",
    `/app/scripts/watch.js --target ${targetId} > /tmp/watch-stdout-${targetId}.log 2> /tmp/watch-stderr-${targetId}.log & echo $!`,
  ]);
  const pid = startResult.stdout.trim();

  // Give watch.js time to attach
  await sleep(800);

  // Execute the work
  await work();

  // Give events time to be logged
  await sleep(800);

  // Kill the watcher
  await docker.execWithResult(CONTAINER_NAME, [
    "bash",
    "-c",
    `kill ${pid} 2>/dev/null || true`,
  ]);
  await sleep(200);

  // Find and read the log file
  const findResult = await docker.execWithResult(CONTAINER_NAME, [
    "bash",
    "-c",
    "find /tmp/browser-logs -name '*.jsonl' -type f | sort | tail -1",
  ]);
  const logFile = findResult.stdout.trim();

  let logLines: string[] = [];
  if (logFile) {
    const catResult = await docker.execWithResult(CONTAINER_NAME, [
      "cat",
      logFile,
    ]);
    logLines = catResult.stdout
      .split("\n")
      .filter((line) => line.trim().length > 0);
  }

  const stderrResult = await docker.execWithResult(CONTAINER_NAME, [
    "cat",
    `/tmp/watch-stderr-${targetId}.log`,
  ]);

  return { logLines, stderr: stderrResult.stdout };
}

/**
 * Navigate a tab to a URL using nav.js and wait for it to load.
 */
export const navigateTab = (tabId: string, url: string) =>
  execScript("nav.js", [url, "--target", tabId]);

/**
 * Evaluate an expression in a specific tab via eval.js.
 */
export const evalTab = (tabId: string, expression: string) =>
  execScript("eval.js", [expression, "--target", tabId]);

/**
 * Register before/after hooks for script tests with a scoped server and tab set.
 */
export const scriptTestFixture = ({
  /** HTML <title> used for the fixture page. */
  title,
  /** HTML inserted into <body> for the fixture page. */
  body,
  /** Number of tabs to create during setup. Defaults to 1. */
  initialTabs = 1,
  /** Navigate the first tab to the fixture server URL during setup. */
  navigateInitialTab = false,
}: {
  title: string;
  body: string;
  initialTabs?: number;
  navigateInitialTab?: boolean;
}) => {
  let server: Awaited<ReturnType<typeof startTestServer>> | undefined;
  let tabs: string[] | undefined;

  before(async () => {
    await waitForReady();
    server = await startTestServer(
      `<!DOCTYPE html><html><head><title>${title}</title></head><body>${body}</body></html>`,
    );
    if (initialTabs > 0) {
      tabs = [];
      for (let i = 0; i < initialTabs; i++) tabs.push((await createTab()).id);
      if (navigateInitialTab) await navigateTab(tabs[0], server.url);
    } else if (navigateInitialTab) {
      throw new Error("navigateInitialTab requires at least one initial tab");
    }
  });

  after(async () => {
    if (tabs) for (const tabId of tabs) await closeTab(tabId);
    tabs = undefined;
    await server?.close();
  });

  return {
    /** Primary tab helper for tests that only need one target. */
    get tab() {
      if (!tabs) throw new Error("Test fixture tabs not initialized yet");
      if (tabs.length === 0) throw new Error("No tabs available in fixture");
      return tabs[0];
    },
    /** Full mutable tab list so tests can track extra tabs they create. */
    get tabs(): string[] {
      if (!tabs) throw new Error("Test fixture tabs not initialized yet");
      return tabs;
    },
    /** Fixture server URL for navigation assertions. */
    get serverUrl() {
      if (!server) throw new Error("Test fixture server not initialized yet");
      return server.url;
    },
  };
};
