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
import { usePlayerShortcuts } from "./hooks/usePlayerShortcuts";
import { usePlayerState } from "./hooks/usePlayerState";
import { useSubtitles } from "./hooks/useSubtitles";
import { isSubtitlePath } from "../shared/subtitleFiles";
import { savePosition } from "./utils/storage";

export function App() {
  const { items, push } = useToasts();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { plan, initialTime, loading, openDialog, openRecent, openDropped, restartAt, onVideoError, queue } = usePlayQueue(videoRef, push);
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

  usePlayerShortcuts({ enabled: !!plan, player, toggleFullscreen: fs.toggle, openFile: openDialog, toggleEffect: fx.toggle, toggleEffectsPanel: toggleEffects, onNext: queue.multi ? queue.next : undefined, onPrevious: queue.multi ? queue.previous : undefined });

  useEffect(() => { window.player.setPlaying(!!plan && !player.paused); }, [plan, player.paused]);
  useEffect(() => { setShowInfo(false); if (plan) push("success", `Playing ${plan.info.name}`); }, [plan?.info.path]);
  useEffect(() => {
    if (plan && player.time > 0) savePosition(plan.info, player.time);
  }, [plan, Math.floor(player.time / 3)]);

  const togglePip = () => {
    const job = document.pictureInPictureElement
      ? document.exitPictureInPicture()
      : videoRef.current?.requestPictureInPicture();
    job?.catch(() => push("error", "Picture in picture isn't available."));
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    // Subtitle branch: a dropped subtitle file while a video is open loads as subtitles.
    if (f && plan && isSubtitlePath(f.name)) return void subs.loadDropped(window.player.pathForFile(f));
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
