#!/usr/bin/env node
// scripts/type.js  –  Type text into an input field
//
// Usage:
//   ./scripts/type.js 'input[name="email"]' 'user@example.com'
//   ./scripts/type.js '#search' 'hello' --clear --enter
//   ./scripts/type.js '#search' 'hello' --target <tab-id>  # target a specific tab
//
// --clear  empties the field before typing.
// --enter  presses Enter after typing.

import { connect, invokePageFn, getTargetId, printHelp } from "./lib.js";

if (process.argv.includes("--help")) printHelp(import.meta.url);

/**
 * @typedef {{ tag: string, type: string }} FocusResult
 */

/**
 * @param {string} targetSelector
 */
const focusFn = (targetSelector) => {
  /** @type {HTMLInputElement | HTMLTextAreaElement | HTMLElement | null} */
  const el = document.querySelector(targetSelector);
  if (!el) return null;
  el.focus();
  return { tag: el.tagName, type: /** @type {any} */ (el).type || "" };
};

/**
 * @param {string} targetSelector
 */
const clearFn = (targetSelector) => {
  /** @type {HTMLInputElement | HTMLTextAreaElement | null} */
  const el = document.querySelector(targetSelector);
  if (!el) return false;
  el.value = "";
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
};

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const selector = positional[0];
const text = positional[1];
const clearFirst = args.includes("--clear");
const pressEnter = args.includes("--enter");

if (!selector || text === undefined) {
  console.error("Usage: type.js '<css-selector>' '<text>' [--clear] [--enter]");
  process.exit(1);
}

let client;

try {
  client = await connect(await getTargetId(args));

  // Focus the element
  const focusedValue = await invokePageFn(client, focusFn, selector);
  if (!focusedValue) {
    throw new Error(`Element not found: ${selector}`);
  }

  /** @type {FocusResult} */
  const focused = focusedValue;

  console.log(`Focused: <${focused.tag.toLowerCase()} type="${focused.type}">`);

  // Clear existing value if requested
  if (clearFirst) {
    const cleared = await invokePageFn(client, clearFn, selector);
    if (!cleared) throw new Error(`Element not found: ${selector}`);
  }

  // Type character by character using Input.dispatchKeyEvent
  for (const char of text) {
    await client.Input.dispatchKeyEvent({
      type: "keyDown",
      text: char,
    });
    await client.Input.dispatchKeyEvent({
      type: "keyUp",
      text: char,
    });
    // Small delay for realism / framework reactivity
    await new Promise((r) => setTimeout(r, 20));
  }

  console.log(`✔ Typed ${text.length} characters`);

  if (pressEnter) {
    const enterBase = {
      windowsVirtualKeyCode: 13,
      key: "Enter",
      code: "Enter",
    };
    await client.Input.dispatchKeyEvent({ type: "keyDown", ...enterBase });
    // The "char" event is required for Chrome to synthesize a form-submit from
    // a CDP-injected Enter key. Without it, keyDown alone does not trigger submit.
    await client.Input.dispatchKeyEvent({ type: "char", text: "\r" });
    await client.Input.dispatchKeyEvent({ type: "keyUp", ...enterBase });
    console.log("✔ Pressed Enter");
  }
} catch (err) {
  console.error("type failed:", err.message);
  process.exit(1);
} finally {
  await client?.close().catch(() => {
    /* best effort */
  });
}
