import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { Socket } from "node:net";
import { after, afterEach, before, beforeEach, describe } from "node:test";
import { getDevcontainerIp } from "./programmatic-docker-suede/devcontainer.js";
import { type Browser, browsers, playwright } from "./release";
import defaults from "./release/defaults.js";

let sessionCounter = 0;

type RequestHandler = (req: IncomingMessage, res: ServerResponse) => void;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export const startTestServer = async (
  handler: string | RequestHandler,
): Promise<{ url: string; port: number; close: () => Promise<void> }> => {
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
};

type FixtureOptions = {
  browser: Browser;
  navigateInitialTab?: boolean;
  serve:
    | RequestHandler
    | {
        title: string;
        body: string;
      };
};

export const createFixture = ({
  browser,
  serve,
  navigateInitialTab = false,
}: FixtureOptions) => {
  let server: Awaited<ReturnType<typeof startTestServer>> | undefined;
  let session: string | undefined;
  const container = defaults.container(browser);

  before(async () => {
    await playwright.ready(container);
    server = await startTestServer(
      "body" in serve
        ? `<!DOCTYPE html><html><head><title>${serve.title}</title></head><body>${serve.body}</body></html>`
        : serve,
    );
  });

  beforeEach(async () => {
    session = `${slugify("title" in serve ? serve.title : "session")}-${process.pid}-${sessionCounter++}`;
    await playwright.open(
      container,
      browser,
      session,
      navigateInitialTab ? server!.url : "about:blank",
    );
  });

  afterEach(async () => {
    if (session) await playwright.close(container, session).catch(() => {});
    session = undefined;
  });

  after(async () => {
    await server?.close();
  });

  return {
    container,
    get session() {
      if (!session) throw new Error("Test session not initialized yet");
      return session;
    },
    get serverUrl() {
      if (!server) throw new Error("Test server not initialized yet");
      return server.url;
    },
  };
};

export const suite = (
  name: string,
  options: Omit<FixtureOptions, "browser">,
  test: (fixture: ReturnType<typeof createFixture>) => void,
) => {
  describe(`top-level: ${name}`, { concurrency: true }, () => {
    for (const browser of browsers)
      describe(`${browser} tests`, { concurrency: 1 }, () =>
        test(createFixture({ browser, ...options })),
      );
  });
};
