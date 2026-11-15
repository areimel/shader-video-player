import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { Controls } from "./components/Controls";
import { EmptyState } from "./components/EmptyState";
import { InfoPanel } from "./components/InfoPanel";
import { ShaderCanvas } from "./components/ShaderCanvas";
import { VideoView } from "./components/VideoView";
import { ToastHost, useToasts } from "./components/common/Toast";
import { useFullscreen } from "./hooks/useFullscreen";
import { useIdleControls } from "./hooks/useIdleControls";
import { usePlaybackSource } from "./hooks/usePlaybackSource";
import { usePlayerShortcuts } from "./hooks/usePlayerShortcuts";
import { usePlayerState } from "./hooks/usePlayerState";
import { useSubtitles } from "./hooks/useSubtitles";
import { devPassthroughEffect } from "./shader/gl/devEffect";
import { savePosition } from "./utils/storage";

const NO_VALUES: Record<string, number> = {};

export function App() {
  const { items, push } = useToasts();
  const { plan, initialTime, loading, openDialog, openRecent, openDropped, restartAt, onVideoError } = usePlaybackSource(push);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef(0);
  const [showInfo, setShowInfo] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Temporary: the `e` key toggles the dev effect until the settings UI replaces this.
  const [effectOn, setEffectOn] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "e" && !e.ctrlKey && !e.metaKey && !e.altKey) setEffectOn((on) => !on);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  audioRef.current = plan?.audioOrdinal ?? 0;
  const restart = useCallback((t: number) => void restartAt(t, audioRef.current), [restartAt]);
  const player = usePlayerState(videoRef, plan, restart);
  const fs = useFullscreen(stageRef);
  const visible = useIdleControls(!!plan && !player.paused);
  const subs = useSubtitles(plan, useCallback((m: string) => push("error", m), [push]));

  usePlayerShortcuts({ enabled: !!plan, player, toggleFullscreen: fs.toggle, openFile: openDialog });

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
    if (f) void openDropped(f);
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
            videoRef={videoRef} plan={plan} initialTime={initialTime} subtitleUrl={subs.url} hidden={effectOn}
            onToggle={player.toggle} onFullscreen={fs.toggle} onError={onVideoError}
          />
          <ShaderCanvas
            videoRef={videoRef} effect={effectOn ? devPassthroughEffect : null} values={NO_VALUES}
            sourceKey={plan.url} onToggle={player.toggle} onFullscreen={fs.toggle}
            onError={(e) => { setEffectOn(false); push("error", e.message.split("\n")[0]); console.error(e); }}
          />
          <Controls
            plan={plan} player={player} visible={visible} fullscreen={fs.active}
            subtitle={subs.selected} onSubtitle={subs.setSelected}
            onAudio={(o) => restartAt(player.time, o)} onFullscreen={fs.toggle}
            onPip={togglePip}
            onInfo={() => setShowInfo(!showInfo)}
          />
          {showInfo && <InfoPanel plan={plan} onClose={() => setShowInfo(false)} />}
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
