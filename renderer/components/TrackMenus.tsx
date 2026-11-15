import { Dropdown } from "./common/Dropdown";
import type { PlaybackPlan } from "../types/player";
import { SUB_OFF, embeddedChoice, externalChoice, type SubtitleState } from "../hooks/useSubtitles";
import { trackLabel } from "../utils/format";

interface Props {
  plan: PlaybackPlan;
  subs: SubtitleState;
  onAudio: (ordinal: number) => void;
}

const LOAD_FILE = "action:load";

export function TrackMenus({ plan, subs, onAudio }: Props) {
  const { audioTracks, subtitleTracks } = plan.info;
  return (
    <>
      {audioTracks.length > 1 && (
        <Dropdown
          icon="audio" label="Audio track" selected={plan.audioOrdinal} onSelect={onAudio}
          options={audioTracks.map((t) => ({ value: t.ordinal, label: trackLabel(t, t.ordinal + 1) }))}
        />
      )}
      <Dropdown
        icon="subtitles" label="Subtitles" selected={subs.choice}
        onSelect={(v) => (v === LOAD_FILE ? void subs.pickFile() : subs.setChoice(v))}
        options={[
          { value: SUB_OFF, label: "Off" },
          ...subtitleTracks.map((t) => ({ value: embeddedChoice(t.ordinal), label: trackLabel(t, t.ordinal + 1) })),
          ...subs.external.map((s) => ({ value: externalChoice(s.id), label: s.name })),
          { value: LOAD_FILE, label: "Load subtitle file…" },
        ]}
      />
    </>
  );
}
