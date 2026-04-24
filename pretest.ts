import {
  container,
  docker,
  image,
} from "./suede/programmatic-docker-suede/index.js";
import { devcontainerNetwork } from "./suede/programmatic-docker-suede/devcontainer.js";
import { CONTAINER_NAME, IMAGE_TAG, RELEASE_DIR } from "./config.js";
import { waitForReady } from "./common.js";

try {
  await container.remove(CONTAINER_NAME);
} catch {
  // container didn't exist — fine
}

console.log(`Building image ${IMAGE_TAG} from ${RELEASE_DIR}...`);
await image.build(IMAGE_TAG, RELEASE_DIR);

const network = await devcontainerNetwork();
console.log(`Detected devcontainer, using network: ${network}`);

console.log(`Starting container ${CONTAINER_NAME}...`);
await container.run({
  network,
  image: IMAGE_TAG,
  name: CONTAINER_NAME,
  command: ["bash", "-c", "node scripts/start.js && tail -f /dev/null"],
});

console.log("Waiting for CDP endpoint...");
let ready = false;

try {
  await waitForReady(40, 500);
  ready = true;
} catch {
  // CDP endpoint not ready
}

if (!ready) {
  console.error("CDP endpoint did not become ready in time.");
  try {
    const { stdout } = await docker(["logs", CONTAINER_NAME]);
    console.error(stdout);
  } catch {
    // best effort
  }
  process.exit(1);
}
