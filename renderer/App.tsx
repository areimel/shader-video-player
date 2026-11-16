import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { EmptyState } from "./components/EmptyState";
import { PlayerStage } from "./components/PlayerStage";
import { ShortcutHelp } from "./components/ShortcutHelp";
import { ToastHost, useToasts } from "./components/common/Toast";
import { useAppCommands } from "./hooks/useAppCommands";
import { useEffectSettings } from "./hooks/useEffectSettings";
import { useFullscreen } from "./hooks/useFullscreen";
import { useIdleControls } from "./hooks/useIdleControls";
import { usePanels } from "./hooks/usePanels";
import { usePlayQueue } from "./hooks/usePlayQueue";
import { useMenuCommands, usePlayerShortcuts } from "./hooks/usePlayerShortcuts";
import { usePlayerState } from "./hooks/usePlayerState";
import { useResumePosition } from "./hooks/useResumePosition";
import { useScreenshot } from "./hooks/useScreenshot";
import { useShowRemaining } from "./hooks/useShowRemaining";
import { useSubtitles } from "./hooks/useSubtitles";
import { isSubtitlePath } from "../shared/subtitleFiles";
import { togglePip } from "./utils/pip";

export function App() {
  const { items, push } = useToasts();
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const { plan, initialTime, loading, openDialog, openRecent, openDropped, restartAt, onVideoError, close, queue } = usePlayQueue(videoRef, push);
  const [dragging, setDragging] = useState(false);
  const fx = useEffectSettings();
  const panels = usePanels();
  const [remaining, toggleRemaining] = useShowRemaining();
  const [helpOpen, setHelpOpen] = useState(false);
  const toggleShortcuts = useCallback(() => setHelpOpen((v) => !v), []);

  const audio = plan?.audioOrdinal ?? 0;
  const restart = useCallback((t: number) => void restartAt(t, audio), [restartAt, audio]);
  const player = usePlayerState(videoRef, plan, restart);
  const fs = useFullscreen(stageRef);
  // The end screen keeps the controls up so the seek bar stays reachable.
  const visible = useIdleControls(!!plan && !player.paused && !panels.showEffects && !queue.ended);
  const subs = useSubtitles(plan, useCallback((m: string) => push("error", m), [push]));
  const captureRef = useRef<(() => Promise<Blob>) | null>(null);
  const screenshot = useScreenshot({ videoRef, captureRef, plan, timeSec: player.time, notify: push });
  const { commands, goHome } = useAppCommands({
    screenshot, toggleRemaining, toggleShortcuts, videoRef, plan, player, fs, fx, subs, queue, panels, notify: push, closeMedia: close, openDialog: () => void openDialog(),
  });
  usePlayerShortcuts(true, commands);
  useMenuCommands(commands);
  useResumePosition(plan, player.time);

  useEffect(() => { window.player.setPlaying(!!plan && !player.paused); }, [plan, player.paused]);
  useEffect(() => { panels.closeInfo(); if (plan) push("success", `Playing ${plan.info.name}`); }, [plan?.info.path]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    // A dropped subtitle while a video is open loads as subtitles; Shift+drop appends to the queue.
    if (files[0] && plan && isSubtitlePath(files[0].name)) return void subs.loadDropped(files[0]);
    if (!files.length) return;
    if (e.shiftKey) void queue.addDropped(files);
    else void openDropped(files);
  };

  return (
    <div
      ref={stageRef} className={`app ${visible ? "" : "hide-cursor"}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)} onDrop={onDrop}
    >
      <div className="drag-region" />
      {plan ? (
        <PlayerStage
          videoRef={videoRef} captureRef={captureRef} plan={plan} initialTime={initialTime} visible={visible} player={player} fullscreen={fs}
          subs={subs} fx={fx} queue={queue} panels={panels} notify={push} onHome={goHome} onVideoError={onVideoError}
          onAudio={(o) => restartAt(player.time, o)} onPip={() => togglePip(videoRef.current, push)}
          remaining={remaining} onToggleRemaining={toggleRemaining}
        />
      ) : (
        <EmptyState onOpen={openDialog} onRecent={openRecent} />
      )}
      {loading && <div className="loading" role="status" aria-label="Loading"><div className="spinner" /></div>}
      {dragging && <div className="drop-overlay">{plan ? "Drop to play (hold Shift to add to queue)" : "Drop to play"}</div>}
      {helpOpen && <ShortcutHelp onClose={() => setHelpOpen(false)} />}
      <ToastHost items={items} />
    </div>
  );
}
