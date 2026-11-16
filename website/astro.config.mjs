import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: process.env.SITE_URL || "https://areimel.github.io",
  base: process.env.SITE_BASE || "/shader-video-player",
  output: "static",
  trailingSlash: "always",
  integrations: [sitemap()],
});
