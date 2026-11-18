import { app, shell } from "electron";

/** Fixed outside links. Only these constants are ever opened; the renderer never supplies a URL. */
export const LINKS = {
  website: "https://areimel.github.io/shader-video-player/",
  issues: "https://github.com/areimel/shader-video-player/issues",
  releases: "https://github.com/areimel/shader-video-player/releases",
} as const;

export function openLink(key: keyof typeof LINKS): void {
  void shell.openExternal(LINKS[key]);
}

export function setAboutPanel(): void {
  app.setAboutPanelOptions({
    applicationName: "Shader Video Player",
    applicationVersion: app.getVersion(),
    copyright: "Copyright © Alec Reimel, Babu Studios. MIT licence.",
    authors: ["Alec Reimel"],
    website: LINKS.website,
  });
}
