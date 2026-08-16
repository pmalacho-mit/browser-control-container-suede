import devcontainer from "../browser-control-container-suede.programmatic-docker-suede/devcontainer.js";

/**
 * A port made reachable on the browser container's own loopback address.
 *
 * Browsers only treat an origin as trustworthy when it is https or localhost,
 * and only a trustworthy origin is given SharedArrayBuffer, service workers,
 * `crypto.subtle`, `getUserMedia`, and the rest of the secure-context APIs. A
 * server reached at the devcontainer's address is none of those, and the page
 * gives no hint why the feature is missing.
 */
export type Forward = {
  /** The port the browser reaches on `localhost`. */
  port: number;
  /** Where to send it. Defaults to the devcontainer. */
  host?: string;
  /** The port to send it to on `host`. Defaults to `port`. */
  target?: number;
};

export type Forwarded = number | Forward;

const normalize = (forward: Forwarded) => {
  const { port, host, target } =
    typeof forward === "number" ? { port: forward } : forward;
  return { port, host, target: target ?? port };
};

/** The network the address should be reachable on, when several qualify. */
const onNetwork = async (network?: string) =>
  network
    ? devcontainer.ip.inspect({
        id: await devcontainer.id(),
        filter: (networks) => (networks.includes(network) ? network : networks[0]),
      })
    : devcontainer.ip.inspect();

/**
 * The `FORWARD` variable the container's entrypoint reads, resolving every
 * forward that did not name a host to the devcontainer's address.
 */
export const encode = async (forwards: Forwarded[], network?: string) => {
  const entries = forwards.map(normalize);
  if (entries.length === 0) return "";

  const fallback = entries.some(({ host }) => host === undefined)
    ? await onNetwork(network)
    : undefined;

  return entries
    .map(({ port, host, target }) => `${port}:${host ?? fallback}:${target}`)
    .join(",");
};
