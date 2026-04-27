import { type Browser, chromium, firefox, webkit } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const TYPES = { chromium, firefox, webkit };
const BROWSER = (process.env.BROWSER || "chromium") as keyof typeof TYPES;
const WS_FILE = process.env.WS_FILE || "/tmp/playwright-ws";

if (!(BROWSER in TYPES))
  throw new Error(
    `Unsupported browser, '${BROWSER}'! Options are: ${Object.keys(TYPES).join(", ")}`,
  );

export const connect = () =>
  TYPES[BROWSER].connect(readFileSync(WS_FILE, "utf-8").trim());

/** Get all pages across all contexts on the server. */
export const allPages = (browser: Browser) =>
  browser.contexts().flatMap((ctx) => ctx.pages());

export const context = async (browser: Browser) =>
  browser.contexts()[0] ?? (await browser.newContext());

/** Resolve --target <index> (default 0). Auto-creates a page if none exist. */
export async function getPage(browser: Browser, args: string[]) {
  const idx = args.indexOf("--target");
  const target = idx !== -1 ? Number(args[idx + 1]) : 0;
  const pages = allPages(browser);

  if (pages.length === 0) return (await context(browser)).newPage();

  if (target < 0 || target >= pages.length)
    throw new Error(`--target ${target} out of range (have ${pages.length})`);

  return pages[target];
}

/**
 * Extract the usage documentation from the top of a script file.
 * Extracts and prints all comment lines at the beginning of the file (after shebang).
 * @param scriptPath - Path to the script file (use import.meta.url if in ES module)
 */
export const getHelp = (scriptPath: string) => {
  const filePath = scriptPath.startsWith("file://")
    ? fileURLToPath(scriptPath)
    : scriptPath;

  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  // Extract comment block from the top (skip shebang)
  const text: string[] = [];
  const start = lines[0]?.startsWith("#!") ? 1 : 0;

  for (let index = start; index < lines.length; index++) {
    const line = lines[index];
    // Remove leading // and spaces
    if (line.startsWith("//")) text.push(line.replace(/^\/\/\s?/, ""));
    // Allow blank comment lines
    else if (line.trim() === "") text.push("");
    // Stop at first non-comment line
    else break;
  }

  return text.join("\n");
};

/**
 * Print the usage documentation from the top of a script file and exit.
 * Extracts and prints all comment lines at the beginning of the file (after shebang).
 * @param scriptPath - Path to the script file (use import.meta.url if in ES module)
 */
export function printHelp(scriptPath: string): never {
  console.log(getHelp(scriptPath));
  process.exit(0);
}

export const arg = (args: string[], key: string) => {
  const index = args.indexOf(key);
  return index >= 0 ? args[index + 1] : undefined;
};
