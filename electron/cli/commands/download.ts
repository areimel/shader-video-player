import type { CliCommand } from "../router";
import { COMMAND_SPECS } from "../args";

export const downloadCommand: CliCommand = {
  name: "download",
  usage: "download <url> [--no-play]",
  summary: "Download a video with yt-dlp and play it",
  flags: COMMAND_SPECS.download.flags,
  mayOpenGui: true,
  async run(ctx) {
    ctx.error("download: not implemented yet");
    return 1;
  },
};
