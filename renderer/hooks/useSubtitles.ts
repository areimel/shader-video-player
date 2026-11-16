import { useCallback, useEffect, useRef, useState } from "react";
import type { ExternalSubtitle, PlaybackPlan } from "../types/player";
import { isSuperseded } from "../../shared/superseded";
import { friendlyError } from "../utils/format";
import { stepDelay as stepDelayValue, type SubSize } from "../utils/subtitleTiming";
import { loadSubSize, saveSubSize } from "../utils/storage";

export const SUB_OFF = "off";
export const embeddedChoice = (ordinal: number) => `emb:${ordinal}`;
export const externalChoice = (id: string) => `ext:${id}`;

export interface SubtitleState {
  /** SUB_OFF, `emb:<ordinal>` or `ext:<id>`. */
  choice: string;
  setChoice: (c: string) => void;
  url: string | null;
  external: ExternalSubtitle[];
  /** Registers an already-validated external subtitle and selects it. */
  adopt: (s: ExternalSubtitle) => void;
  pickFile: () => Promise<void>;
  loadDropped: (file: File) => Promise<void>;
  /** Seconds the subtitles are shifted later (negative = earlier). Reset to 0 when the track changes. */
  delay: number;
  /** Moves the delay by SUB_DELAY_STEP; returns the new value (for a toast). */
  stepDelay: (dir: 1 | -1) => number;
  resetDelay: () => void;
  size: SubSize;
  setSize: (s: SubSize) => void;
}

function fetchVtt(choice: string, offset: number): Promise<string> {
  if (choice.startsWith("emb:")) return window.player.getSubtitle(Number(choice.slice(4)), offset);
  return window.player.getExternalSubtitle(choice.slice(4), offset);
}

/**
 * Loads the selected embedded or external subtitle as a WebVTT blob URL. Both are converted by ffmpeg
 * with the stream's `startOffset` subtracted, so cue times match the (possibly restarted) video element.
 */
export function useSubtitles(plan: PlaybackPlan | null, onError: (m: string) => void): SubtitleState {
  const [choice, setChoice] = useState(SUB_OFF);
  const [url, setUrl] = useState<string | null>(null);
  const [external, setExternal] = useState<ExternalSubtitle[]>([]);
  const [delay, setDelay] = useState(0);
  const [size, setSizeState] = useState<SubSize>(loadSubSize);
  const delayRef = useRef(0);
  delayRef.current = delay;
  const file = plan?.info.path;
  const offset = plan?.startOffset ?? 0;

  useEffect(() => {
    setChoice(SUB_OFF);
    setExternal([]);
    if (!file) return;
    let cancelled = false;
    window.player.findSubtitles().then((found) => {
      if (cancelled) return;
      setExternal(found);
      // Auto-select the first sibling file unless the user already picked a track.
      if (found[0]) setChoice((c) => (c === SUB_OFF ? externalChoice(found[0].id) : c));
    }).catch(() => { /* no siblings offered */ });
    return () => { cancelled = true; };
  }, [file]);

  useEffect(() => { setDelay(0); }, [choice]);

  useEffect(() => {
    if (choice === SUB_OFF) { setUrl(null); return; }
    let cancelled = false;
    let made: string | null = null;
    fetchVtt(choice, offset)
      .then((vtt) => {
        if (cancelled) return;
        made = URL.createObjectURL(new Blob([vtt], { type: "text/vtt" }));
        setUrl(made);
      })
      .catch((e) => { if (!cancelled && !isSuperseded(e)) { setChoice(SUB_OFF); onError(friendlyError(e)); } });
    return () => { cancelled = true; if (made) URL.revokeObjectURL(made); };
  }, [choice, offset, file, onError]);

  const adopt = useCallback((s: ExternalSubtitle) => {
    setExternal((list) => (list.some((x) => x.id === s.id) ? list : [...list, s]));
    setChoice(externalChoice(s.id));
  }, []);

  const pickFile = useCallback(async () => {
    try {
      const s = await window.player.pickSubtitle();
      if (s) adopt(s);
    } catch (e) { onError(friendlyError(e)); }
  }, [adopt, onError]);

  const loadDropped = useCallback(async (file: File) => {
    try { adopt(await window.player.loadDroppedSubtitle(file)); } catch (e) { onError(friendlyError(e)); }
  }, [adopt, onError]);

  const stepDelay = useCallback((dir: 1 | -1) => {
    const next = stepDelayValue(delayRef.current, dir);
    delayRef.current = next;
    setDelay(next);
    return next;
  }, []);
  const resetDelay = useCallback(() => setDelay(0), []);
  const setSize = useCallback((s: SubSize) => { setSizeState(s); saveSubSize(s); }, []);

  return { choice, setChoice, url, external, adopt, pickFile, loadDropped, delay, stepDelay, resetDelay, size, setSize };
}
