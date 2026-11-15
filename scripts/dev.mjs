import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// The npm-installed chrome-sandbox is never setuid root, so Chromium's SUID sandbox aborts.
// In dev only, fall back to --no-sandbox when it is not (the packaged .deb installs it setuid).
function sandboxArgs() {
  try {
    const helper = join(dirname(createRequire(import.meta.url).resolve("electron")), "dist", "chrome-sandbox");
    const st = statSync(helper);
    if (st.uid === 0 && (st.mode & 0o4000) !== 0) return [];
  } catch {}
  console.warn("[dev] chrome-sandbox is not setuid root; launching Electron with --no-sandbox (dev only)");
  return ["--no-sandbox"];
}

const run = (cmd, args, env = {}) =>
  spawn(cmd, args, { stdio: "inherit", env: { ...process.env, ...env } });

const children = [];
const stop = () => children.forEach((c) => c.kill("SIGTERM"));
process.on("SIGINT", () => { stop(); process.exit(0); });
process.on("SIGTERM", () => { stop(); process.exit(0); });

children.push(run("pnpm", ["exec", "vite"]));
children.push(run("node", ["scripts/build-electron.mjs", "--watch"]));
await new Promise((r) => run("pnpm", ["exec", "wait-on", "http://localhost:5173", "dist-electron/main.js"]).on("exit", r));
const app = run("pnpm", ["exec", "electron", ...sandboxArgs(), "."], { VITE_DEV_SERVER_URL: "http://localhost:5173" });
children.push(app);
app.on("exit", () => { stop(); process.exit(0); });
