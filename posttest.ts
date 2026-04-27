import { container } from "./suede/programmatic-docker-suede";
import { CONTAINER_NAME, BROWSERS } from "./config.js";

for (const browser of BROWSERS) {
  const name = CONTAINER_NAME(browser);
  console.log(`Removing container ${name}...`);
  try {
    await container.remove(name);
  } catch {
    // ignore if already removed
  }
}
