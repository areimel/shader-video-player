#!/usr/bin/env bash
# Shader Video Player (CRT-TV) installer for Debian, Ubuntu and Pop!_OS on x86_64.
#
#   curl -fsSL https://areimel.github.io/shader-video-player/install.sh | bash
#
# Downloads the newest .deb (pre-releases included) from GitHub Releases, checks it
# against the release's SHA256SUMS and installs it with apt, which also pulls in ffmpeg.
# Everything runs inside main(), so a download cut off mid-way never runs half a script.

set -euo pipefail

REPO="areimel/shader-video-player"
PACKAGE="shader-video-player"

say() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

main() {
  [ "$(uname -s)" = "Linux" ] || die "this installer is for Linux."
  case "$(uname -m)" in
    x86_64 | amd64) ;;
    *) die "only x86_64 builds are published (this machine is $(uname -m))." ;;
  esac
  command -v apt-get >/dev/null 2>&1 && command -v dpkg >/dev/null 2>&1 \
    || die "apt and dpkg are required (Debian, Ubuntu, Pop!_OS, Mint...)."
  command -v curl >/dev/null 2>&1 || die "curl is required."
  command -v sha256sum >/dev/null 2>&1 || die "sha256sum is required."

  local sudo=""
  if [ "$(id -u)" -ne 0 ]; then
    command -v sudo >/dev/null 2>&1 || die "run as root or install sudo."
    sudo="sudo"
  fi

  say "Looking up the newest release of $REPO"
  local releases deb_url sums_url
  releases="$(curl -fsSL -H 'Accept: application/vnd.github+json' "https://api.github.com/repos/$REPO/releases?per_page=1")" \
    || die "could not reach the GitHub API."
  deb_url="$(printf '%s\n' "$releases" | grep -o '"browser_download_url": *"[^"]*_amd64\.deb"' | head -n1 | sed 's/.*"\(https[^"]*\)"$/\1/')"
  sums_url="$(printf '%s\n' "$releases" | grep -o '"browser_download_url": *"[^"]*/SHA256SUMS"' | head -n1 | sed 's/.*"\(https[^"]*\)"$/\1/')"
  [ -n "$deb_url" ] || die "no .deb found in the newest release."
  [ -n "$sums_url" ] || die "the newest release has no SHA256SUMS file."

  local tmp deb
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  deb="${deb_url##*/}"

  say "Downloading $deb"
  curl -fL --progress-bar -o "$tmp/$deb" "$deb_url"
  curl -fsSL -o "$tmp/SHA256SUMS" "$sums_url"

  say "Verifying checksum"
  (cd "$tmp" && grep -F " $deb" SHA256SUMS | sha256sum -c --status -) \
    || die "checksum mismatch for $deb; nothing was installed."

  # apt runs as _apt and must be able to read the file.
  chmod 755 "$tmp"
  chmod 644 "$tmp/$deb"

  say "Installing (you may be asked for your password)"
  $sudo apt-get update -qq || true
  $sudo apt-get install -y "$tmp/$deb"

  local version
  version="$(dpkg-query -W -f='${Version}' "$PACKAGE" 2>/dev/null || echo "?")"
  say "Installed Shader Video Player $version"
  echo "    Open it from your app launcher, or run: $PACKAGE"
  echo "    Uninstall with: sudo apt remove $PACKAGE"
}

main "$@"
