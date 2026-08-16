import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/**
 * Adds a certificate to every store a browser in this image consults. There is
 * no single one — each browser looks somewhere different:
 *
 *   - Chromium reads an NSS database at ~/.pki/nssdb.
 *   - WebKit goes through glib-networking, which reads the system store.
 *   - Firefox reads a database inside its profile, and Playwright starts from a
 *     fresh profile every launch, so the certificate is declared as an
 *     enterprise policy instead. Firefox applies those to every profile.
 *
 * Usage: node /trust.mjs <nickname> <certificate, base64 encoded>
 */
const [nickname, base64] = process.argv.slice(2);

const SYSTEM_CERTIFICATES = "/usr/local/share/ca-certificates";
const NSS_DATABASE = join(homedir(), ".pki", "nssdb");
const PLAYWRIGHT_BROWSERS = join(homedir(), ".cache", "ms-playwright");

const run = (command, args) => execFileSync(command, args, { stdio: "pipe" });

const attempt = (command, args) => {
  try {
    run(command, args);
  } catch {
    // Creating a database that exists, or dropping an entry that does not.
  }
};

/** What OpenSSL and glib-networking read, and so what WebKit trusts. */
const system = () => run("update-ca-certificates", []);

/** What Chromium reads. */
const nss = (certificate) => {
  mkdirSync(NSS_DATABASE, { recursive: true });
  const database = `sql:${NSS_DATABASE}`;
  attempt("certutil", ["-d", database, "-N", "--empty-password"]);
  attempt("certutil", ["-d", database, "-D", "-n", nickname]);
  run("certutil", ["-d", database, "-A", "-t", "C,,", "-n", nickname, "-i", certificate]);
};

const installationsOf = (browser) =>
  existsSync(PLAYWRIGHT_BROWSERS)
    ? readdirSync(PLAYWRIGHT_BROWSERS)
        .filter((name) => name.startsWith(`${browser}-`))
        .map((name) => join(PLAYWRIGHT_BROWSERS, name, browser))
        .filter(existsSync)
    : [];

const parse = (file) => {
  try {
    return JSON.parse(readFileSync(file, "utf-8"));
  } catch {
    return {};
  }
};

const including = (existing, certificate) => {
  const certificates = existing.policies?.Certificates ?? {};
  const install = new Set([...(certificates.Install ?? []), certificate]);
  return {
    ...existing,
    policies: {
      ...existing.policies,
      Certificates: { ...certificates, Install: [...install] },
    },
  };
};

/** What Firefox applies to every profile it opens, however fresh. */
const firefox = (certificate) => {
  for (const installation of installationsOf("firefox")) {
    const policies = join(installation, "distribution", "policies.json");
    mkdirSync(dirname(policies), { recursive: true });
    writeFileSync(
      policies,
      JSON.stringify(including(parse(policies), certificate), null, 2),
    );
  }
};

/** Kept where the system store expects it, so every mechanism can point at it. */
const certificate = join(SYSTEM_CERTIFICATES, `${nickname}.crt`);
mkdirSync(SYSTEM_CERTIFICATES, { recursive: true });
writeFileSync(certificate, Buffer.from(base64, "base64"));

system();
nss(certificate);
firefox(certificate);
