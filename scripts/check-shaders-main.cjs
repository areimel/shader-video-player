// Electron entry for scripts/check-shaders.mjs: runs the bundled compile check in a hidden window.
const { app, BrowserWindow } = require("electron");
const { readFileSync } = require("node:fs");

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
  await win.loadURL("data:text/html,<html><body></body></html>");
  let code = 1;
  try {
    const bundle = readFileSync(process.argv[process.argv.length - 1], "utf8");
    const { compiled, errors } = await win.webContents.executeJavaScript(`${bundle}\nsvpShaderCheck.run()`);
    for (const name of compiled) console.log(`ok    ${name}`);
    for (const { pass, message } of errors) console.error(`FAIL  ${pass}\n${message}\n`);
    console.log(`${compiled.length} passes compiled, ${errors.length} failed`);
    code = errors.length ? 1 : 0;
  } catch (e) {
    console.error(e);
  }
  app.exit(code);
});
