import { resolve } from "node:path";

export const BROWSERS = ["chromium", "firefox", "webkit"] as const;
export type Browser = (typeof BROWSERS)[number];

export const CONTAINER_NAME_PREFIX = "browser-control-test";
export const CONTAINER_NAME = <const T extends Browser>(browser: T) =>
  `${CONTAINER_NAME_PREFIX}-${browser}` as const;

export const IMAGE_TAG = <const T extends Browser>(browser: T) =>
  `${CONTAINER_NAME(browser)}:latest` as const;

export const RELEASE_DIR = resolve(import.meta.dirname, "release");
