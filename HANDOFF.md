# HANDOFF — certificate trust + port forwarding

Written 2026-08-16, mid-task, because the devcontainer needs a restart (see
[Why this exists](#why-this-exists)). Everything needed to finish is here.

**Delete this file when the work is done.** It is a scratch note, not a
deliverable.

---

## Where things stand in one line

The feature is **implemented and manually verified for all three browsers**;
what remains is running the two new test files and the full suite against
freshly built images.

---

## Why this exists

The task: finish the half-built `## Reaching a server the browser will trust`
and port-forwarding work on this branch, make it work across browsers, and test
it locally.

Partway through, the devcontainer's **inner Docker daemon wedged**: a
`runc:[2:INIT]` process went into uninterruptible `D` state (PPID 0,
root-owned), with every `docker` CLI call blocked in `d_alloc_parallel`. This is
a sysbox/FUSE VFS stall, not anything caused by the code. It could not be
cleared from inside — the processes are unkillable and root-owned. The user
controls the outer daemon and was going to `docker restart 2d25bb486097` (this
devcontainer).

**After the restart:** Docker images live on `/dev/vdb1` and should survive. If
`docker images | grep browser-control` is empty, they just need rebuilding —
`npm run pretest` does it (~10 min for all three).

---

## Environment quirks that will confuse you if you don't know them

- **Docker topology is docker-in-docker (sysbox).** This matters a lot:
  `devcontainer.ip()` (from `node:os` interfaces) returns `172.17.0.21`, but
  `devcontainer.ip.inspect()` — the address a *sibling container* reaches the
  devcontainer at — returns `172.18.0.1`, the network **gateway**. They are
  different addresses. This asymmetry caused one of the two bugs below.
- **This machine sits behind an intercepting TLS proxy** (`desolate-proxy`).
  `/usr/local/share/ca-certificates/desolate-proxy.crt` is its CA.
- **`node:22-bookworm-slim` is shadowed.** `docker images` shows that tag
  pointing at the same image id as `desolate-ca/node:22-bookworm-slim` — the
  base already carries the proxy CA in its system store. A
  `desolate-ca/pristine/node:22-bookworm-slim` exists as the un-injected base.
  This is why the old README said WebKit's result "had no negative control".
  **The tests now sidestep this entirely** by generating their own CA per run.
- **`npm install` has already been run**, but a restart does not remove
  `node_modules`. If it is missing, run `npm install`.
- The one-line `package-lock.json` diff is incidental fallout from `npm
  install`. Revert it if it is noise.

---

## Git state

Branch `downstream/pmalacho-mit/python-web-kernel-suede-ca06c1d9c7ffa6d06f478aa02305a0dbbe033445`,
HEAD at `bcdd851`.

> Note: the local branch was one commit **behind** `origin/…` at the start — the
> WIP was only on the remote. It has been fast-forwarded. Don't be surprised if
> `git log` looks unfamiliar.

Everything below is **uncommitted working-tree state**. Nothing has been
committed, and the user has not asked for a commit.

```
 M common.ts
 M package-lock.json          <- incidental, from npm install
 M release/README.md
 M release/docker/Dockerfile
 M release/docker/trust.mjs
?? certificate-authority.ts
?? certificates.test.ts
?? forward.test.ts
?? release/docker/roots.mjs
```

---

## The two real bugs that were found and fixed

### 1. Firefox certificate trust never could have worked

The WIP wrote `Certificates.Install` into
`<firefox-install>/distribution/policies.json`. That file is **never read** by
Playwright's Firefox. Established by reading the actual shipped code, not by
guessing — extract it with:

```bash
docker cp browser-control-firefox:/root/.cache/ms-playwright/firefox-1538/firefox/omni.ja /tmp/omni.ja
python3 -c "import zipfile; z=zipfile.ZipFile('/tmp/omni.ja'); \
  open('/tmp/epp.mjs','wb').write(z.read('modules/EnterprisePoliciesParent.sys.mjs'))"
```

What that file shows:

- `shouldIgnoreLocalPolicies()` returns true on `NIGHTLY_BUILD && isInAutomation`
  — exactly what Playwright's Firefox is — so stock Firefox deliberately ignores
  local policies here anyway.
- More decisively, Playwright **patched out** `_chooseProvider()` and hardcoded
  `let provider = new PlaywrightPoliciesProvider()`, a class that reads **only**
  the preference `browser.policies.alternatePath` and nothing else. Neither
  `distribution/` nor `/etc/firefox/policies/` is consulted.
- Setting that preference still does nothing, because `policies-startup` is
  never fired, so `_initialize()` never runs.

**Ruled out, with evidence — do not re-litigate these:**

| Approach | Result |
|---|---|
| `distribution/policies.json` | never read (provider patched out) |
| `/etc/firefox/policies/policies.json` | same |
| `browser.policies.alternatePath` as a **default** pref in `defaults/pref/` | set correctly, still nothing |
| same as a **user** pref in `user.js` | confirmed applied to `prefs.js`, still nothing |
| AutoConfig (`general.config.filename` + `mozilla.cfg`) | does not run, via either default or user pref |
| pre-seeding the profile's `cert9.db` | pointless — Playwright makes a fresh profile per launch |

Note `defaults/pref/*.js` **is** parsed — verified by planting a syntax error in
`defaults/pref/zz-probe.js` and getting `prefs parse error: unknown keyword`. So
the failures above are not "the file wasn't read".

**The fix** — `release/docker/roots.mjs`, which is what Debian's own Firefox
packaging does. NSS answers root questions from a loadable PKCS#11 module named
`libnssckbi.so` next to the binary; **Playwright's Firefox ships without one**
(confirmed: no such file in the install dir). p11-kit ships a drop-in with the
same interface that answers from the system store instead of a compiled-in list.
Symlinking it into place makes `update-ca-certificates` the single thing
deciding what Firefox trusts — the same store WebKit already reads.

Applied in two places on purpose:
- `RUN node /roots.mjs` in the Dockerfile, so a container resolves roots the same
  way whether or not a certificate is ever installed;
- again from `trust.mjs` on install, so a Firefox that Playwright downloaded
  *after* the image was built is still covered.

### 2. Port forwarding was untestable as written

`release/forward.ts`'s `encode()` correctly targets `devcontainer.ip.inspect()`
(`172.18.0.1` here). But `common.ts`'s `startTestServer` bound the server to
`devcontainer.ip()` (`172.17.0.21`) only — so a forward dialled an address with
nothing listening, and the browser hung until timeout.

Fixed by binding `0.0.0.0`, which is what `devcontainer.ip`'s own doc comment
already tells you to do. The README now documents the gotcha for users.

---

## Files changed

| File | What |
|---|---|
| `release/docker/roots.mjs` | **new** — points Firefox at the system trust store via p11-kit. Exports `useSystemRoots()` / `installationsOf()`; runnable directly. |
| `release/docker/trust.mjs` | rewritten and **simplified** — the dead Firefox policy code is gone. Now: write cert → `update-ca-certificates` (Firefox + WebKit) → `certutil` into `~/.pki/nssdb` (Chromium) → `useSystemRoots()`. |
| `release/docker/Dockerfile` | adds `p11-kit-modules` to the apt line, copies `roots.mjs`, runs `node /roots.mjs` at build. |
| `common.ts` | `startTestServer` binds `0.0.0.0` (see bug 2) and takes an optional `ServerCertificate` to serve `https`. |
| `certificate-authority.ts` | **new** test helper — generates a throwaway CA + server cert per run via `openssl`. SANs cover `localhost`, `127.0.0.1`, and the devcontainer IP, so one authority serves both the direct and forwarded routes. |
| `certificates.test.ts` | **new** — negative control → install → loads, per browser. |
| `forward.test.ts` | **new** — `encode()` units, reachability + secure-context contrast per browser, `skipIfRunning` reuse-vs-replace. |
| `release/README.md` | Firefox section rewritten from "**not working**" to what is now true; forwarding section gained the bind-to-`0.0.0.0` note. |

Untouched from the WIP, and correct as-is: `release/certificates.ts`,
`release/forward.ts`, `release/docker/forward.mjs`, `release/index.ts`,
`release/defaults.ts`.

---

## What was actually verified (before the daemon wedged)

Measured by hand with a throwaway probe script, against a **freshly generated
CA** — so the negative control is real, unlike the old README's proxy-CA
measurement:

| browser | no CA installed | CA installed |
|---|---|---|
| chromium | `net::ERR_CERT_AUTHORITY_INVALID` | loads, `document.title === "secured"` |
| firefox | `SEC_ERROR_UNKNOWN_ISSUER` | loads |
| webkit | `Unacceptable TLS certificate` | loads |

Forwarding (chromium): `http://localhost:<port>` serves the devcontainer's page
and `window.isSecureContext === true`; the same server at the direct
devcontainer address gives `false`.

**Caveat worth being honest about:** the Firefox and WebKit *forwarding* paths
were never exercised — only chromium. `forward.test.ts` covers all three, so the
run below is what confirms it.

**Also unconfirmed:** the p11-kit fix was verified by hot-patching a *running*
container. The Dockerfile now bakes it in, but that rebuilt image has never
successfully produced a running container — the rebuild is what wedged the
daemon. Treat the first clean `npm run pretest` as part of the verification.

---

## Finish the job

```bash
# 1. sanity — daemon healthy again?
docker ps
docker images | grep browser-control

# 2. build images + start the three shared containers (~10 min cold)
npm run pretest

# 3. the two new files first — these are the feature under test
npm run test -- certificates.test.ts
npm run test -- forward.test.ts

# 4. then the whole suite, which must not have regressed
#    (common.ts changed, so every existing test is affected)
CONCURRENCY=2 npm run test:all
```

Use a **low `CONCURRENCY`**. The daemon wedge happened while three image builds
and three container creates ran at once, and the repo README already warns the
suite can exhaust the daemon. Do not run the suite wide open.

If a container is left behind: `npm run posttest`, plus
`docker rm -f browser-control-forward-{chromium,firefox,webkit} browser-control-forward-reuse`.

### Things that might legitimately fail, and what they'd mean

- **`certificates.test.ts` firefox fails** → the p11-kit link didn't survive
  being baked into the image. Check
  `docker exec browser-control-firefox ls -la /root/.cache/ms-playwright/firefox-*/firefox/libnssckbi.so`;
  it should be a symlink into `/usr/lib/<triplet>/pkcs11/p11-kit-trust.so`. Note
  `findTrustModule()` in `roots.mjs` globs the multiarch triplet directory — this
  machine is `aarch64-linux-gnu`, so that path is arm64-specific by discovery,
  not hardcoded.
- **`forward.test.ts` firefox/webkit fail** → the genuinely unverified path.
  Debug with `docker exec <container> node -e "..."` or check the `FORWARD` env
  on the container: `docker inspect <name> --format '{{.Config.Env}}'`.
- **An existing test fails** → most likely the `common.ts` `0.0.0.0` change.
  `server.url` still reports `devcontainer.ip()`, so it should be transparent,
  but that is the thing to suspect.

### Last steps

1. Re-read `release/README.md` end to end against the test results and correct
   anything that overstates. The previous version's overclaiming is the specific
   failure mode to avoid repeating.
2. Delete this file.
3. Report results plainly — including anything that failed.
