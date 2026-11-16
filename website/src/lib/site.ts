export function url(path = ""): string {
  return `${import.meta.env.BASE_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

/** Absolute URL of a path on this site (origin from SITE_URL, path through url()). */
export function absoluteUrl(path = ""): string {
  return new URL(url(path), import.meta.env.SITE).href;
}

const repository = "https://github.com/areimel/shader-video-player";

export const site = {
  name: "CRT-TV",
  description: "Your videos. Back on the tube. A Linux video player with real-time CRT and VHS effects.",
  repository,
  releases: `${repository}/releases`,
  issues: `${repository}/issues`,
  author: { name: "Alec Reimel", url: "https://github.com/areimel" },
  installCommand: `curl -fsSL ${absoluteUrl("install.sh")} | bash`,
};

export const navigation = [
  { label: "Home", path: "", channel: "01" },
  { label: "Download", path: "download/", channel: "02" },
  { label: "Docs", path: "docs/", channel: "03" },
  { label: "Contact", path: "contact/", channel: "04" },
];
