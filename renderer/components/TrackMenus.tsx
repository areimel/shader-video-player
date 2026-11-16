import { Dropdown } from "./common/Dropdown";
import { SubtitleMenu } from "./SubtitleMenu";
import type { PlaybackPlan } from "../types/player";
import type { SubtitleState } from "../hooks/useSubtitles";
import { trackLabel } from "../utils/format";

interface Props {
  plan: PlaybackPlan;
  subs: SubtitleState;
  onAudio: (ordinal: number) => void;
}

export function TrackMenus({ plan, subs, onAudio }: Props) {
  const { audioTracks } = plan.info;
  return (
    <>
      {audioTracks.length > 1 && (
        <Dropdown
          icon="audio" label="Audio track" selected={plan.audioOrdinal} onSelect={onAudio}
          options={audioTracks.map((t) => ({ value: t.ordinal, label: trackLabel(t, t.ordinal + 1) }))}
        />
      )}
      <SubtitleMenu plan={plan} subs={subs} />
    </>
  );
}
