import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { preview } from "astro";

const cwd = fileURLToPath(new URL("../", import.meta.url));

function run(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", args, { cwd, env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`pnpm ${args.join(" ")} exited ${code}`)));
  });
}

async function checkAvailablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", () => reject(new Error("Port 4321 is in use. Stop the website server before browser tests.")));
    server.listen(4321, "127.0.0.1", resolve);
  });
  await new Promise((resolve) => server.close(resolve));
}

async function testBuild(configured) {
  const env = {
    ...process.env,
    SITE_URL: "https://areimel.github.io",
    SITE_BASE: "/shader-video-player",
    PUBLIC_WEB3FORMS_ACCESS_KEY: configured ? "test-access-key" : "",
    TEST_FORMS_UNCONFIGURED: configured ? "0" : "1",
  };
  await run(["build"], env);
  const server = await preview({ root: cwd, base: "/shader-video-player", server: { host: "127.0.0.1", port: 4321 } });
  try {
    await run(["exec", "playwright", "test"], env);
  } finally {
    await server.stop();
  }
}

await checkAvailablePort();
let failure;
try { await testBuild(true); } catch (error) { failure = error; }
// Finish with a build containing no test key, even if configured tests failed.
try { await testBuild(false); } catch (error) { failure ??= error; }
if (failure) throw failure;
