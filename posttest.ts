import { container } from "./suede/programmatic-docker-suede/index.js";
import { CONTAINER_NAME } from "./config.js";

console.log(`Removing container ${CONTAINER_NAME}...`);
try {
  await container.remove(CONTAINER_NAME);
} catch {
  // container already gone — fine
}
console.log("Cleanup complete.");
