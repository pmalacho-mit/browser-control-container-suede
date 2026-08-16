import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const openssl = (args: string[]) => run("openssl", args);

/**
 * A certificate authority created for one test, and a server certificate it
 * signed.
 *
 * The authority is generated fresh every time, so nothing on this machine or
 * in the image trusts it until it is installed. That is what makes the
 * negative control meaningful: a browser rejecting the server proves the
 * certificate is doing the work, rather than the base image happening to
 * carry the same root already.
 */
export type Authority = {
  /** The root certificate, as a path to hand to `trustCertificates`. */
  path: string;
  /** PEM key and certificate for a server the authority vouches for. */
  server: { key: string; cert: string };
  dispose: () => Promise<void>;
};

/**
 * Names the certificate covers. Both the address the devcontainer is reached
 * at and `localhost` are included, so one authority serves both the direct
 * and the forwarded route to the same server.
 */
const extensionsFor = (ip: string) =>
  [
    "basicConstraints=CA:FALSE",
    "keyUsage=critical,digitalSignature,keyEncipherment",
    "extendedKeyUsage=serverAuth",
    `subjectAltName=DNS:localhost,IP:127.0.0.1,IP:${ip}`,
  ].join("\n");

/** Unique per run, so concurrent suites never collide on the stored nickname. */
let counter = 0;

export const authority = async (ip: string): Promise<Authority> => {
  const directory = await mkdtemp(join(tmpdir(), "browser-control-ca-"));
  const at = (name: string) => join(directory, name);
  const name = `browser-control-test-ca-${process.pid}-${counter++}`;

  const caKey = at("ca.key");
  const caCertificate = at(`${name}.crt`);
  const key = at("server.key");
  const request = at("server.csr");
  const certificate = at("server.crt");
  const extensions = at("server.ext");

  await openssl([
    "req", "-x509", "-newkey", "rsa:2048", "-nodes",
    "-keyout", caKey, "-out", caCertificate,
    "-days", "1", "-subj", `/CN=${name}`,
    "-addext", "basicConstraints=critical,CA:TRUE",
    "-addext", "keyUsage=critical,keyCertSign,cRLSign",
  ]);

  await writeFile(extensions, extensionsFor(ip));

  await openssl([
    "req", "-newkey", "rsa:2048", "-nodes",
    "-keyout", key, "-out", request, "-subj", `/CN=${ip}`,
  ]);

  await openssl([
    "x509", "-req", "-in", request,
    "-CA", caCertificate, "-CAkey", caKey, "-CAcreateserial",
    "-out", certificate, "-days", "1",
    "-extfile", extensions,
  ]);

  return {
    path: caCertificate,
    server: {
      key: await readFile(key, "utf-8"),
      cert: await readFile(certificate, "utf-8"),
    },
    dispose: () => rm(directory, { recursive: true, force: true }),
  };
};
