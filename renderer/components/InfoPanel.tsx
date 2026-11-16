import type { PlaybackPlan } from "../types/player";
import { formatBitrate, formatBytes, formatTime } from "../utils/format";
import { Button } from "./common/Button";
import { Panel, PanelHeader } from "./common/Panel";

interface Props {
  plan: PlaybackPlan;
  onClose: () => void;
}

export function InfoPanel({ plan, onClose }: Props) {
  const i = plan.info;
  const engine = plan.mode === "native" ? "Native" : plan.remuxOnly ? "ffmpeg (remux)" : "ffmpeg (transcode)";
  const rows: [string, string][] = [
    ["Name", i.name],
    ["Container", i.container],
    ["Video codec", `${i.videoCodec}${i.profile ? ` (${i.profile})` : ""}`],
    ["Resolution", `${i.width}×${i.height}`],
    ["Frame rate", i.fps ? `${i.fps.toFixed(2)} fps` : "—"],
    ["Bitrate", formatBitrate(i.bitrate)],
    ["Duration", formatTime(i.durationSec)],
    ["Size", formatBytes(i.sizeBytes)],
    ["Audio", i.audioTracks.map((t) => t.codec).join(", ") || "none"],
    ["Playback", engine],
  ];
  return (
    <Panel className="info-panel" role="dialog" aria-label="File info" onDismiss={onClose}
      onDoubleClick={(e) => e.stopPropagation()}>
      <PanelHeader title="File info">
        <Button variant="link" onClick={onClose}>Close</Button>
      </PanelHeader>
      <dl>
        {rows.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
      </dl>
      <Button onClick={() => window.player.reveal(i.path)}>Show in folder</Button>
    </Panel>
  );
}
