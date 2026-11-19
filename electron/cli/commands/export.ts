import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import type { CliCommand } from "../router";
import { EXIT_CANCELLED, EXIT_FAIL, EXIT_OK, EXIT_USAGE } from "../router";
import { COMMAND_SPECS } from "../args";
import { watchJob } from "../watchJob";
import { defaultSize, parseSize } from "../../export/exportArgs";
import { startExport } from "../../export/exportJob";
import { uniqueName } from "../../media/outputName";
import { appVideosDir, writableDirOr } from "../../media/outputDir";
import { probeFile } from "../../media/probe";

const MAX_SETTINGS_BYTES = 64 * 1024;

const flagText = (v: string | true | undefined): string | undefined => (typeof v === "string" ? v : undefined);

async function readSettings(file: string): Promise<unknown> {
  const s = await stat(file);
  if (!s.isFile() || s.size > MAX_SETTINGS_BYTES) throw new Error(`settings file must be a regular file of at most ${MAX_SETTINGS_BYTES / 1024} KB`);
  try {
    const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not an object");
    // Accept both a bare values object and a saved effect state ({ presetId, values }).
    const values = (parsed as { values?: unknown }).values;
    return typeof values === "object" && values !== null ? values : parsed;
  } catch {
    throw new Error("settings file is not a JSON object of parameter values");
  }
}

export const exportCommand: CliCommand = {
  name: "export",
  usage: "export <file> [--effect id] [--preset id] [--settings f.json] [--size WxH] [-o out]",
  summary: "Render a video with a shader effect baked in",
  flags: COMMAND_SPECS.export.flags,
  needsGpu: true,
  async run(ctx) {
    const input = resolve(ctx.positionals[0] ?? "");
    const effect = flagText(ctx.flags.effect);
    const preset = flagText(ctx.flags.preset);
    for (const [name, v] of [["effect", effect], ["preset", preset]] as const) {
      if (v !== undefined && (v.length === 0 || v.length > 64)) {
        ctx.error(`export: invalid --${name}`);
        return EXIT_USAGE;
      }
    }
    const sizeText = flagText(ctx.flags.size);
    const forcedSize = sizeText === undefined ? null : parseSize(sizeText);
    if (sizeText !== undefined && !forcedSize) {
      ctx.error("export: --size must be WxH with even dimensions between 16 and 7680, e.g. 1920x1080");
      return EXIT_USAGE;
    }
    if (!existsSync(input)) {
      ctx.error(`export: no such file: ${input}`);
      return EXIT_FAIL;
    }
    const settingsFile = flagText(ctx.flags.settings);
    const raw = settingsFile ? await readSettings(resolve(settingsFile)) : undefined;

    const info = await probeFile(input);
    const size = forcedSize ?? defaultSize({ width: info.width, height: info.height });
    let out = flagText(ctx.flags.output);
    if (out === undefined) {
      const dir = await writableDirOr(dirname(input), await appVideosDir());
      out = uniqueName(dir, `${basename(input, extname(input))}.${effect ?? preset ?? "fx"}`, "mp4", existsSync);
    } else {
      out = resolve(out);
      if (out === input) {
        ctx.error("export: the output must differ from the input");
        return EXIT_USAGE;
      }
    }

    const job = startExport({
      path: input, info, settings: { effectId: effect, presetId: preset, raw }, size,
      audioOrdinal: info.audioTracks[0]?.ordinal ?? 0, out,
    });
    await watchJob(job, ctx.reporter, ctx.signal);

    if (job.state === "done") {
      ctx.reporter.finish(`Wrote ${out} (${size.width}x${size.height})`);
      return EXIT_OK;
    }
    if (job.state === "cancelled") return EXIT_CANCELLED;
    ctx.error(`export: ${job.error ?? "failed"}`);
    return EXIT_FAIL;
  },
};
