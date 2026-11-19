import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src svp-media: blob:";
const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8")) as { version: string; author: string };

export default defineConfig({
  root: resolve(__dirname, "renderer"),
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_AUTHOR__: JSON.stringify(pkg.author),
  },
  plugins: [
    react(),
    {
      name: "svp-csp",
      apply: "build",
      transformIndexHtml: (html) =>
        html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`),
    },
  ],
  build: {
    outDir: resolve(__dirname, "dist-renderer"), emptyOutDir: true,
    // Second page: the hidden export window (served at /export.html in dev too).
    rolldownOptions: { input: { main: resolve(__dirname, "renderer/index.html"), export: resolve(__dirname, "renderer/export.html") } },
    // The CSP has no data: font-src: never inline font files (Press Start 2P's subsets are under the 4 KB default).
    assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
  },
  server: { port: 5173, strictPort: true },
  test: { root: resolve(__dirname), include: ["tests/**/*.test.ts"] },
});
