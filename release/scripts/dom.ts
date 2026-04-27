#!/usr/bin/env -S npx tsx
// scripts/dom.ts  –  Inspect the page DOM
//
// Usage:
//   ./scripts/dom.ts                             # outline of the full page
//   ./scripts/dom.ts 'form'                      # show all <form> subtrees
//   ./scripts/dom.ts --links                     # list all links
//   ./scripts/dom.ts --inputs                    # list all input/button/select elements
//   ./scripts/dom.ts --text 'main'               # extract visible text from <main>
//   ./scripts/dom.ts --target <id>               # inspect a specific tab (default: first open tab)

import { connect, arg, getPage, printHelp } from "./lib.ts";

if (process.argv.includes("--help")) printHelp(import.meta.url);

const args = process.argv.slice(2);
const showLinks = args.includes("--links");
const showInputs = args.includes("--inputs");
const textSelector = arg(args, "--text");

// Skip flag *values* (--text X, --target Y) when looking for the positional selector
const skipIdx = new Set(
  ["--text", "--target"].map((f) => args.indexOf(f) + 1).filter((i) => i > 0),
);
const selector = args.find((a, i) => !a.startsWith("--") && !skipIdx.has(i));

let browser;
try {
  browser = await connect();
  const page = await getPage(browser, args);

  if (showLinks) {
    const links = await page.$$eval("a[href]", (els: HTMLAnchorElement[]) =>
      els
        .map((a) => ({
          text: (a.textContent ?? "").trim().slice(0, 100),
          href: a.href,
        }))
        .filter((l) => l.text || l.href),
    );
    for (const l of links)
      console.log(`  ${l.text || "(empty)"}\n    → ${l.href}\n`);
    console.log(`${links.length} link(s)`);
  } else if (showInputs) {
    const inputs = await page.$$eval(
      "input, button, select, textarea",
      (els: HTMLInputElement[]) =>
        // Cast to HTMLInputElement covers the props we actually read; missing
        // props (e.g. .placeholder on <button>) are simply undefined at runtime.
        els.map((e) => ({
          tag: e.tagName.toLowerCase(),
          type: e.type || "",
          name: e.name || "",
          id: e.id || "",
          placeholder: e.placeholder || "",
          value: (e.value || "").slice(0, 50),
          text: (e.textContent ?? "").trim().slice(0, 50),
          selector: e.id
            ? "#" + e.id
            : e.name
              ? `${e.tagName.toLowerCase()}[name="${e.name}"]`
              : "",
        })),
    );
    for (const inp of inputs) {
      const desc = [
        `<${inp.tag}`,
        inp.type ? ` type="${inp.type}"` : "",
        inp.name ? ` name="${inp.name}"` : "",
        inp.id ? ` id="${inp.id}"` : "",
        ">",
      ].join("");
      const hint = inp.placeholder || inp.text || inp.value || "";
      console.log(`  ${desc}${hint ? "  →  " + hint : ""}`);
      if (inp.selector) console.log(`    selector: ${inp.selector}`);
      console.log();
    }
    console.log(`${inputs.length} interactive element(s)`);
  } else if (textSelector) {
    // One round-trip with a body fallback if the selector doesn't match
    const text = await page.evaluate(
      (sel) =>
        ((document.querySelector(sel) as HTMLElement | null) ?? document.body)
          .innerText,
      textSelector,
    );
    console.log(text);
  } else if (selector) {
    // $$eval returns [] on no matches (unlike $eval which throws), so the
    // empty-string fallback handles "no matches" cleanly.
    const html = await page.$$eval(selector, (els) =>
      els.map((el) => el.outerHTML.slice(0, 500)).join("\n---\n"),
    );
    console.log(html || "(no matches)");
  } else {
    // Page outline: title, URL, headings, landmark counts — single evaluate
    // for one round-trip across many counts.
    const info = await page.evaluate(() => ({
      title: document.title,
      url: location.href,
      headings: Array.from(document.querySelectorAll("h1,h2,h3")).map((h) => ({
        level: h.tagName,
        text: (h.textContent ?? "").trim().slice(0, 120),
      })),
      forms: document.forms.length,
      links: document.links.length,
      images: document.images.length,
      inputs: document.querySelectorAll("input,button,select,textarea").length,
    }));
    console.log(`Title:   ${info.title}`);
    console.log(`URL:     ${info.url}`);
    console.log(
      `Links:   ${info.links}  |  Forms: ${info.forms}  |  Inputs: ${info.inputs}  |  Images: ${info.images}`,
    );
    if (info.headings.length > 0) {
      console.log(`\nHeadings:`);
      for (const h of info.headings) console.log(`  ${h.level}  ${h.text}`);
    }
  }
} catch (err) {
  console.error("dom failed:", err);
  process.exit(1);
} finally {
  await browser?.close().catch(() => {});
}
