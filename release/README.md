# Browser Control

This package ships a Docker image with Playwright installed and `playwright-cli`
available on `PATH` inside the container.

The preferred integration is the TypeScript API in `index.ts`, which builds and
runs the container for a selected browser.

## Preferred Usage

```ts
import { buildAndRun } from "./release/index.js"; // or use .ts extension if not using a bundler

await buildAndRun("chromium");
```

Supported browsers:

- `chromium`
- `firefox`
- `webkit`

The container idles after startup, so you can execute commands into it.

## Reaching a server the browser will trust

A browser only treats an origin as trustworthy when it is `https` or
`localhost`, and only a trustworthy origin is given the secure-context APIs:
`SharedArrayBuffer`, service workers, `crypto.subtle`, `getUserMedia`,
WebAuthn, persistent storage. A server reached at the devcontainer's address is
none of those, and a page that needs one of those APIs simply finds it missing.

`forward` makes a port reachable on the browser's own loopback address, which
is:

```ts
await buildAndRun("chromium", { forward: [5173] });
// the browser can now open http://localhost:5173, served by the devcontainer
```

A forward defaults to the devcontainer on the container's network. Name a
`host` to send it somewhere else, and a `target` to change ports on the way:

```ts
await buildAndRun("chromium", {
  forward: [{ port: 8080, host: "api.internal", target: 80 }],
});
```

Changing what is forwarded is a reason to replace the container, so
`skipIfRunning` only reuses one that already forwards the same thing.

## Certificates

Chromium reads its roots from an NSS database rather than the system store, so
a certificate this machine trusts — an intercepting proxy's CA, say — means
nothing to the browser until it is added there. Without it, every cross-origin
`https` request fails as a bare `TypeError: Failed to fetch`.

```ts
import { buildAndRun, certificates } from "./index.js";

await buildAndRun("chromium", {
  trustCertificates: await certificates.local(),
});
```

`certificates.local()` returns the extra roots this machine trusts
(`/usr/local/share/ca-certificates`), and is empty when there are none. Explicit
paths work too. Installing is idempotent, and also runs when a container is
reused, so a newly added certificate takes effect without replacing it.

`docker/trust.mjs` does the work, and writes to each place a browser might look:

| Browser  | Reads                                   | Status                     |
| -------- | --------------------------------------- | -------------------------- |
| Chromium | an NSS database at `~/.pki/nssdb`        | works                      |
| WebKit   | the system store, via glib-networking    | works                      |
| Firefox  | a database inside the profile            | **not working** — see below |

Measured against an origin behind an intercepting proxy, loading the page with
and without the certificate installed:

```
chromium without the CA: blocked (net::ERR_CERT_AUTHORITY_INVALID)
chromium with the CA:    loaded
webkit   without the CA: loaded      ← base image already trusted it
webkit   with the CA:    loaded
firefox  without the CA: blocked (SEC_ERROR_UNKNOWN_ISSUER)
firefox  with the CA:    blocked (SEC_ERROR_UNKNOWN_ISSUER)
```

WebKit's row has no negative control: the image is built `FROM
node:22-bookworm-slim`, and on this machine that base already carried the CA in
its system store. The result is consistent with WebKit reading the system store,
but does not prove `update-ca-certificates` is what did it. Building the image
from a base without the certificate would settle it.

### Firefox, and what has been ruled out

Playwright starts Firefox from a fresh profile every launch, so writing into a
profile's `cert9.db` is pointless. `trust.mjs` therefore declares the
certificate as an [enterprise
policy](https://mozilla.github.io/policy-templates/#certificates), which Firefox
is meant to apply to every profile it opens.

The file is written and is well formed, in every installed version:

```
~/.cache/ms-playwright/firefox-1522/firefox/distribution/policies.json
{ "policies": { "Certificates": { "Install": ["/usr/local/share/ca-certificates/desolate-proxy.crt"] } } }
```

Firefox still rejects the certificate. Leads, roughly in order:

1. Read `about:policies#errors` in the launched browser — it says whether the
   policy engine ran at all, and whether it rejected this entry.
2. Playwright's Firefox is a patched build; enterprise policies may be compiled
   out of it. If so, `Certificates.Install` can never work and the mechanism
   should be dropped rather than left in place.
3. `/etc/firefox/policies/policies.json` is the other location Firefox reads on
   Linux, and is worth trying before concluding the engine is absent.
4. Failing all of that, the honest fallback is `ignoreHTTPSErrors` at the
   Playwright context level — a much larger hammer, since it disables
   verification entirely, and one this package cannot reach from outside
   `playwright-cli`.

## CLI Usage

Build the image directly:

```bash
docker build --build-arg BROWSER=chromium -t browser-control-chromium:latest .
docker run -d --rm --name browser-control-chromium browser-control-chromium:latest
docker exec browser-control-chromium playwright-cli --help
```

Because `/app/node_modules/.bin` is on `PATH`, `playwright-cli` is available
without a full path.
