import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { Controls } from "./components/Controls";
import { EmptyState } from "./components/EmptyState";
import { InfoPanel } from "./components/InfoPanel";
import { EffectsPanel } from "./components/effects/EffectsPanel";
import { ShaderCanvas } from "./components/ShaderCanvas";
import { VideoView } from "./components/VideoView";
import { ToastHost, useToasts } from "./components/common/Toast";
import { useEffectSettings } from "./hooks/useEffectSettings";
import { useFullscreen } from "./hooks/useFullscreen";
import { useIdleControls } from "./hooks/useIdleControls";
import { usePlayQueue } from "./hooks/usePlayQueue";
import { useMenuCommands, usePlayerShortcuts, type CommandHandlers } from "./hooks/usePlayerShortcuts";
import { SEEK_LONG_SEC, SEEK_STEP_SEC } from "../shared/commands";
import { usePlayerState } from "./hooks/usePlayerState";
import { useSubtitles } from "./hooks/useSubtitles";
import { isSubtitlePath } from "../shared/subtitleFiles";
import { savePosition } from "./utils/storage";

export function App() {
  const { items, push } = useToasts();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { plan, initialTime, loading, openDialog, openRecent, openDropped, restartAt, onVideoError, close, queue } = usePlayQueue(videoRef, push);
  const stageRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef(0);
  const [showInfo, setShowInfo] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fx = useEffectSettings();
  const [showEffects, setShowEffects] = useState(false);
  const closeEffects = useCallback(() => setShowEffects(false), []);
  const toggleEffects = useCallback(() => { setShowEffects((v) => !v); setShowInfo(false); }, []);

  audioRef.current = plan?.audioOrdinal ?? 0;
  const restart = useCallback((t: number) => void restartAt(t, audioRef.current), [restartAt]);
  const player = usePlayerState(videoRef, plan, restart);
  const fs = useFullscreen(stageRef);
  const visible = useIdleControls(!!plan && !player.paused && !showEffects);
  const subs = useSubtitles(plan, useCallback((m: string) => push("error", m), [push]));

  const togglePip = () => {
    const job = document.pictureInPictureElement
      ? document.exitPictureInPicture()
      : videoRef.current?.requestPictureInPicture();
    job?.catch(() => push("error", "Picture in picture isn't available."));
  };
  const media: CommandHandlers = plan ? {
    togglePlay: player.toggle,
    seekBack: () => player.seek(player.time - SEEK_STEP_SEC),
    seekForward: () => player.seek(player.time + SEEK_STEP_SEC),
    seekBackLong: () => player.seek(player.time - SEEK_LONG_SEC),
    seekForwardLong: () => player.seek(player.time + SEEK_LONG_SEC),
    volumeUp: () => player.setVolume(player.volume + 0.05),
    volumeDown: () => player.setVolume(player.volume - 0.05),
    mute: player.toggleMute,
    speedDown: () => player.stepRate(-1),
    speedUp: () => player.stepRate(1),
    ...(queue.multi && { next: queue.next, previous: queue.previous }),
    toggleEffect: fx.toggle,
    toggleEffectsPanel: toggleEffects,
    fullscreen: fs.toggle,
    info: () => { setShowInfo((v) => !v); closeEffects(); },
    pip: togglePip,
    loadSubtitle: () => void subs.pickFile(),
    close,
  } : {};
  const commands: CommandHandlers = { ...media, open: () => void openDialog() };
  usePlayerShortcuts(true, commands);
  useMenuCommands(commands);

  useEffect(() => { window.player.setPlaying(!!plan && !player.paused); }, [plan, player.paused]);
  useEffect(() => { setShowInfo(false); if (plan) push("success", `Playing ${plan.info.name}`); }, [plan?.info.path]);
  // `player.time` still holds the previous file's playhead right after a plan change; save only once it has moved.
  const timeBase = useRef<{ plan: typeof plan; stale: number }>({ plan, stale: player.time });
  useEffect(() => {
    const base = timeBase.current;
    if (base.plan !== plan) { timeBase.current = { plan, stale: player.time }; return; }
    if (plan && player.time > 0 && player.time !== base.stale) savePosition(plan.info, player.time);
  }, [plan, Math.floor(player.time / 3)]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    // Subtitle branch: a dropped subtitle file while a video is open loads as subtitles.
    if (f && plan && isSubtitlePath(f.name)) return void subs.loadDropped(f);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) void openDropped(files);
  };

  return (
    <div
      ref={stageRef} className={`app ${visible ? "" : "hide-cursor"}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)} onDrop={onDrop}
    >
      <div className="drag-region" />
      {plan ? (
        <>
          <VideoView
            videoRef={videoRef} plan={plan} initialTime={initialTime} subtitleUrl={subs.url} controlsVisible={visible} hidden={!!fx.effect}
            onToggle={player.toggle} onFullscreen={fs.toggle} onError={onVideoError}
          />
          <ShaderCanvas
            videoRef={videoRef} effect={fx.effect} values={fx.values}
            sourceKey={plan.url} onToggle={player.toggle} onFullscreen={fs.toggle}
            onError={(e) => { fx.setEffect(null); push("error", e.message.split("\n")[0]); console.error(e); }}
          />
          <Controls
            plan={plan} player={player} visible={visible} fullscreen={fs.active}
            subs={subs}
            onAudio={(o) => restartAt(player.time, o)} onFullscreen={fs.toggle}
            onPip={togglePip}
            onInfo={() => { setShowInfo(!showInfo); closeEffects(); }}
            effectsActive={!!fx.effect} onEffects={toggleEffects} queue={queue}
          />
          {showInfo && <InfoPanel plan={plan} onClose={() => setShowInfo(false)} />}
          {showEffects && <EffectsPanel fx={fx} onClose={closeEffects} />}
        </>
      ) : (
        <EmptyState onOpen={openDialog} onRecent={openRecent} />
      )}
      {loading && <div className="loading" role="status" aria-label="Loading"><div className="spinner" /></div>}
      {dragging && <div className="drop-overlay">Drop to play</div>}
      <ToastHost items={items} />
    </div>
  );
}
