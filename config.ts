import { resolve } from "node:path";

export const CONTAINER_NAME = "browser-control-test";
export const IMAGE_TAG = `${CONTAINER_NAME}:latest`;
export const BASE_URL = "http://127.0.0.1";
export const CDP_PORT = 9222;
export const CDP_URL = `${BASE_URL}:${CDP_PORT}`;
export const RELEASE_DIR = resolve(import.meta.dirname, "release");
