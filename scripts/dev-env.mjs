import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
export const dashboardDir = path.join(repoRoot, "apps/dashboard");
export const emulatorDir = path.join(repoRoot, "apps/emulator");
export const DASHBOARD_PORT = 3000;
export const DASHBOARD_URL = `http://localhost:${DASHBOARD_PORT}`;

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const isPosix = process.platform !== "win32";

export class DevSetupError extends Error {}

function createLogger(tag) {
  return (message) => console.log(`\x1b[35m[${tag}]\x1b[0m ${message}`);
}

export function assertToolchain() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 6)) {
    throw new DevSetupError(
      `Node ${process.versions.node} is too old. DiffKit needs Node 22.6 or newer (the emulator runs TypeScript with --experimental-strip-types).`
    );
  }
  if (!existsSync(path.join(dashboardDir, "node_modules/.bin/vite"))) {
    throw new DevSetupError(
      "Dependencies are not installed. Run `pnpm install` first."
    );
  }
}

function acceptsConnections(port, host) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    socket.setTimeout(500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

function capture(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

function describePortOwner(port) {
  const pid = capture("lsof", [
    "-nP",
    `-iTCP:${port}`,
    "-sTCP:LISTEN",
    "-t",
  ]).split("\n")[0];
  if (!pid) {
    return "another process";
  }
  const command = capture("ps", ["-o", "command=", "-p", pid]).slice(0, 120);
  const cwd = capture("lsof", ["-a", "-p", pid, "-d", "cwd", "-Fn"])
    .split("\n")
    .find((line) => line.startsWith("n"))
    ?.slice(1);
  return [`pid ${pid}`, command, cwd && `in ${cwd}`].filter(Boolean).join(", ");
}

export async function assertPortsFree(ports) {
  const busy = [];
  for (const { port, name } of ports) {
    const results = await Promise.all([
      acceptsConnections(port, "127.0.0.1"),
      acceptsConnections(port, "::1"),
    ]);
    if (results.some(Boolean)) {
      busy.push(`  :${port} (${name}) is used by ${describePortOwner(port)}`);
    }
  }
  if (busy.length > 0) {
    throw new DevSetupError(
      [
        "Required ports are busy:",
        ...busy,
        "Stop that process (often another `pnpm dev` or `pnpm dev:demo`) and run this again.",
        "The ports are fixed because the OAuth callback URLs point at them.",
      ].join("\n")
    );
  }
}

export function runStep(description, args, { cwd, env } = {}) {
  const result = spawnSync(pnpm, args, {
    cwd: cwd ?? repoRoot,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    throw new DevSetupError(
      `${description} failed (${result.error?.message ?? `exit ${result.status}`}).`
    );
  }
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function waitForResponse(url, { timeoutMs, abandon }) {
  const deadline = Date.now() + timeoutMs;
  const poll = async () => {
    while (Date.now() < deadline) {
      try {
        return await fetch(url, {
          redirect: "manual",
          signal: AbortSignal.timeout(Math.max(deadline - Date.now(), 1)),
        });
      } catch {
        await pause(300);
      }
    }
    throw new DevSetupError(
      `${url} did not answer within ${timeoutMs / 1000}s.`
    );
  };
  const exited = abandon.then(() => {
    throw new DevSetupError(`The server for ${url} exited before answering.`);
  });
  return Promise.race([poll(), exited]);
}

function prefixLines(stream, label, color) {
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      process.stdout.write(`\x1b[${color}m[${label}]\x1b[0m ${line}\n`);
    }
  });
}

function signalTree(child, signal) {
  try {
    if (isPosix) {
      process.kill(-child.pid, signal);
    } else {
      child.kill(signal);
    }
  } catch {
    // Already gone.
  }
}

// Each child gets its own process group so stopping it also stops workerd and
// esbuild, which otherwise outlive pnpm and keep ports 3000/4001 bound.
function createSupervisor(log) {
  const children = new Set();
  let lifecycle = { status: "running" };

  function stop(exitCode, reason) {
    if (lifecycle.status === "stopping") {
      return;
    }
    lifecycle = { status: "stopping", exitCode };
    if (reason) {
      log(reason);
    }
    const exits = [...children].map(
      (child) => new Promise((resolve) => child.once("exit", resolve))
    );
    for (const child of children) {
      signalTree(child, "SIGTERM");
    }
    const forceKill = setTimeout(() => {
      for (const child of children) {
        signalTree(child, "SIGKILL");
      }
    }, 5000);
    Promise.all(exits).then(() => {
      clearTimeout(forceKill);
      process.exit(lifecycle.exitCode);
    });
  }

  function start(label, color, args, { cwd, env } = {}) {
    const child = spawn(pnpm, args, {
      cwd,
      detached: isPosix,
      env: { ...process.env, FORCE_COLOR: "1", ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    children.add(child);
    prefixLines(child.stdout, label, color);
    prefixLines(child.stderr, label, color);
    const exited = new Promise((resolve) => {
      child.once("exit", (code, signal) => {
        children.delete(child);
        stop(code || 1, `${label} exited (${signal ?? code}); stopping.`);
        resolve();
      });
    });
    return { exited };
  }

  process.on("SIGINT", () => stop(0));
  process.on("SIGTERM", () => stop(0));

  return { start, stop };
}

export async function warmUpDashboard(log, dashboard) {
  const startedAt = Date.now();
  const response = await waitForResponse(`${DASHBOARD_URL}/login`, {
    timeoutMs: 180_000,
    abandon: dashboard.exited,
  });
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  if (response.status >= 500) {
    throw new DevSetupError(
      `The first request to /login failed with ${response.status} after ${seconds}s. See the dashboard output above.`
    );
  }
  log(`dashboard ready at ${DASHBOARD_URL} (first request ${seconds}s)`);
}

export function runDevScript(tag, main) {
  const log = createLogger(tag);
  const supervisor = createSupervisor(log);
  main({ log, supervisor }).catch((error) => {
    if (error instanceof DevSetupError) {
      supervisor.stop(1, `\x1b[31m${error.message}\x1b[0m`);
    } else {
      console.error(error);
      supervisor.stop(1);
    }
  });
}
