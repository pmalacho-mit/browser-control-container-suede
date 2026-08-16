import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { useSystemRoots } from "./roots.mjs";

/**
 * Adds a certificate to the stores the browsers in this image read. There are
 * two, not three:
 *
 *   - Firefox and WebKit both end up at the system store — WebKit through
 *     glib-networking, Firefox through the roots module `roots.mjs` installs.
 *   - Chromium reads an NSS database at ~/.pki/nssdb, and nothing else.
 *
 * Usage: node /trust.mjs <nickname> <certificate, base64 encoded>
 */
const [nickname, base64] = process.argv.slice(2);

const SYSTEM_CERTIFICATES = "/usr/local/share/ca-certificates";
const NSS_DATABASE = join(homedir(), ".pki", "nssdb");

const run = (command, args) => execFileSync(command, args, { stdio: "pipe" });

const attempt = (command, args) => {
  try {
    run(command, args);
  } catch {
    // Creating a database that exists, or dropping an entry that does not.
  }
};

const write = (path, contents) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
};

/** What OpenSSL, glib-networking and p11-kit read, and so what all but Chromium trust. */
const system = () => run("update-ca-certificates", []);

/** What Chromium reads. */
const nss = (certificate) => {
  mkdirSync(NSS_DATABASE, { recursive: true });
  const database = `sql:${NSS_DATABASE}`;
  attempt("certutil", ["-d", database, "-N", "--empty-password"]);
  attempt("certutil", ["-d", database, "-D", "-n", nickname]);
  run("certutil", [
    "-d", database, "-A", "-t", "C,,", "-n", nickname, "-i", certificate,
  ]);
};

const certificate = join(SYSTEM_CERTIFICATES, `${nickname}.crt`);
write(certificate, Buffer.from(base64, "base64"));

system();
nss(certificate);

/**
 * Re-applied here as well as at build time, so a Firefox that Playwright
 * downloaded after the image was built still reads the system store.
 */
useSystemRoots();
