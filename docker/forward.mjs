import net from "node:net";

/**
 * The container's idle process, which also forwards ports onto the container's
 * own loopback address.
 *
 * A browser only treats an origin as trustworthy when it is https or localhost,
 * and only a trustworthy origin is given SharedArrayBuffer, service workers,
 * crypto.subtle, and the rest of the secure-context APIs. A dev server reached
 * at the devcontainer's address is none of those; the same server reached
 * through a forward is.
 *
 * `FORWARD` is a comma separated list of `<port>:<host>:<port>` entries.
 */
const parse = (entry) => {
  const [port, host, target] = entry.split(":");
  return { port: Number(port), host, target: Number(target) };
};

const forward = ({ port, host, target }) =>
  net
    .createServer((browser) => {
      const server = net.connect(target, host);
      browser.pipe(server);
      server.pipe(browser);
      browser.on("error", () => {});
      server.on("error", () => {});
    })
    .listen(port, "127.0.0.1", () =>
      console.log(`forwarding localhost:${port} to ${host}:${target}`),
    );

(process.env.FORWARD ?? "")
  .split(",")
  .filter(Boolean)
  .map(parse)
  .forEach(forward);

setInterval(() => {}, 1 << 30);
