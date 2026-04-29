# Browser-control-container-suede

This repo is a [suede dependency](https://github.com/pmalacho-mit/suede).

To see the installable source code, please checkout the [release branch](https://github.com/pmalacho-mit/browser-control-container-suede/tree/release).

## Installation

```bash
bash <(curl https://suede.sh/install-release) --repo pmalacho-mit/browser-control-container-suede
```

<details>
<summary>
See alternative to using <a href="https://github.com/pmalacho-mit/suede#suedesh">suede.sh</a> script proxy
</summary>

```bash
bash <(curl https://raw.githubusercontent.com/pmalacho-mit/suede/refs/heads/main/scripts/install-release.sh) --repo pmalacho-mit/browser-control-container-suede
```

</details>

## Testing

> [!WARNING]
> The test suite spawns Docker containers and can exhaust Docker daemon CPU and memory resources under high concurrency. Always run the full suite with a concurrency limit.

Run all tests with the default concurrency limit (which is calculated as half of the available CPU cores on the Docker host, i.e. `docker info --format '{{.NCPU}}' | awk '{print int($1/2)}'`):

```bash
npm run test:all
```

Override the concurrency limit via the `CONCURRENCY` environment variable:

```bash
CONCURRENCY=1 npm run test:all  # serial — safest for resource-constrained environments
CONCURRENCY=4 npm run test:all  # increase only if your Docker daemon has ample resources
```
