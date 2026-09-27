/**
 * Runs the same pipeline as .github/workflows/ci.yml, on this machine.
 *
 *   npm run ci:local              full run (checks + docker)
 *   npm run ci:local -- --no-docker    skip the container stage
 *
 * Kept deliberately in lockstep with ci.yml: if you add a step there, add it
 * here. A green run here should mean a green run on GitHub.
 */
import { spawnSync } from "node:child_process";

const NO_DOCKER = process.argv.includes("--no-docker");

const IMAGE = "markdown-studio:ci-local";
const CONTAINER = "markdown-studio-ci-local";
// Not 3000: that is usually taken by `npm run dev`.
const PORT = 3100;

const t0 = Date.now();
const results: Array<{ name: string; ok: boolean; skipped?: boolean; ms: number }> = [];

const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

function heading(text: string): void {
  console.log(`\n${c.cyan}${c.bold}── ${text}${c.reset}`);
}

/**
 * Runs a shell command, streaming its output. Returns true on exit code 0.
 *
 * `shell: true` is required, not incidental: on Windows `npm` is a .cmd shim,
 * and since CVE-2024-27980 Node refuses to spawn .cmd/.bat files without a
 * shell. The command is passed as one string rather than a string plus an args
 * array, because that combination is what triggers Node's DEP0190 warning about
 * unescaped argument concatenation. Every command below is a fixed literal — no
 * external input is ever interpolated — so there is nothing to escape.
 */
function run(command: string, opts: { quiet?: boolean } = {}): boolean {
  const r = spawnSync(command, {
    stdio: opts.quiet ? "pipe" : "inherit",
    shell: true,
    encoding: "utf8",
  });
  return r.status === 0;
}

/** Runs a named stage and records the result. Returns false if it failed. */
function stage(name: string, fn: () => boolean): boolean {
  heading(name);
  const start = Date.now();
  const ok = fn();
  const ms = Date.now() - start;
  results.push({ name, ok, ms });
  if (!ok) console.log(`${c.red}✗ ${name} failed${c.reset}`);
  return ok;
}

function skip(name: string, why: string): void {
  heading(name);
  console.log(`${c.yellow}skipped — ${why}${c.reset}`);
  results.push({ name, ok: true, skipped: true, ms: 0 });
}

function dockerAvailable(): boolean {
  return run("docker info", { quiet: true });
}

function removeContainer(): void {
  run(`docker rm -f ${CONTAINER}`, { quiet: true });
}

async function waitForServer(timeoutMs = 45_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${PORT}/`);
      if (res.ok) return true;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/**
 * The stage that actually matters: a built image only proves the layers
 * assemble. This proves headless Chromium launches as a non-root user with its
 * sandbox off, and returns real PDF bytes.
 */
async function exportPdf(): Promise<boolean> {
  const res = await fetch(`http://localhost:${PORT}/api/export-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      markdown: '# CI\n\nHello **world**.\n\n```go\nfmt.Println("hi")\n```\n',
      filename: "ci",
    }),
  });

  if (!res.ok) {
    console.log(`${c.red}export returned HTTP ${res.status}${c.reset}`);
    console.log(await res.text());
    return false;
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  // An error body would also arrive with a 200-shaped download, so trust the
  // magic bytes rather than the status code alone.
  const magic = new TextDecoder().decode(bytes.slice(0, 4));
  if (magic !== "%PDF") {
    console.log(`${c.red}response was not a PDF (starts with "${magic}")${c.reset}`);
    console.log(new TextDecoder().decode(bytes.slice(0, 400)));
    return false;
  }

  console.log(`${c.green}PDF generated in-container: ${bytes.byteLength} bytes${c.reset}`);
  return true;
}

async function main(): Promise<number> {
  console.log(`${c.bold}Local CI — mirrors .github/workflows/ci.yml${c.reset}`);
  console.log(`${c.dim}node ${process.version}${c.reset}`);

  // ---- stage 1: the same checks the `check` job runs -----------------------
  if (!stage("Lint", () => run("npm run lint"))) return 1;
  if (!stage("Typecheck", () => run("npm run typecheck"))) return 1;
  if (!stage("Markdown & sanitizer tests", () => run("npm run test:markdown"))) return 1;
  if (!stage("Build", () => run("npm run build"))) return 1;

  // ---- stage 2: the `docker` job ------------------------------------------
  if (NO_DOCKER) {
    skip("Docker", "--no-docker passed");
    return report();
  }

  if (!dockerAvailable()) {
    skip("Docker", "Docker daemon not reachable (is Docker Desktop running?)");
    return report();
  }

  if (!stage("Docker build", () => run(`docker build -t ${IMAGE} .`))) return 1;

  const containerStage = await (async (): Promise<boolean> => {
    heading("Docker run + PDF export");
    const start = Date.now();

    removeContainer(); // in case a previous run died mid-way
    let ok = run(`docker run -d --name ${CONTAINER} -p ${PORT}:3000 ${IMAGE}`);

    if (ok) {
      ok = await waitForServer();
      if (!ok) console.log(`${c.red}container never became ready${c.reset}`);
    }

    if (ok) ok = await exportPdf();

    if (!ok) {
      console.log(`\n${c.dim}--- container logs ---${c.reset}`);
      run(`docker logs ${CONTAINER}`);
    }

    removeContainer();
    results.push({ name: "Docker run + PDF export", ok, ms: Date.now() - start });
    return ok;
  })();

  if (!containerStage) return 1;

  return report();
}

function report(): number {
  const failed = results.filter((r) => !r.ok);
  const total = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\n${c.bold}── Summary${c.reset}`);
  for (const r of results) {
    const mark = r.skipped
      ? `${c.yellow}skip${c.reset}`
      : r.ok
        ? `${c.green}pass${c.reset}`
        : `${c.red}FAIL${c.reset}`;
    const time = r.skipped ? "" : `${c.dim}(${(r.ms / 1000).toFixed(1)}s)${c.reset}`;
    console.log(`  ${mark}  ${r.name} ${time}`);
  }

  if (failed.length) {
    console.log(`\n${c.red}${c.bold}FAILED${c.reset} in ${total}s`);
    return 1;
  }
  console.log(`\n${c.green}${c.bold}ALL GREEN${c.reset} in ${total}s — safe to push.`);
  return 0;
}

// Leave no orphaned container behind if the run is interrupted.
process.on("SIGINT", () => {
  console.log("\ninterrupted — cleaning up");
  removeContainer();
  process.exit(130);
});

process.exit(await main());
