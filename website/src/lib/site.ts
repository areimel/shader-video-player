export const site = {
  name: "CRT-TV",
  description: "Your videos. Back on the tube. A Linux video player with real-time CRT and VHS effects.",
  repository: "https://github.com/areimel/shader-video-player",
  installCommand: "curl -fsSL https://example.com/crt-tv/install.sh",
};

export function url(path = ""): string {
  return `${import.meta.env.BASE_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export const navigation = [
  { label: "Home", path: "", channel: "01" },
  { label: "Download", path: "download/", channel: "02" },
  { label: "Docs", path: "docs/", channel: "03" },
  { label: "Contact", path: "contact/", channel: "04" },
];
