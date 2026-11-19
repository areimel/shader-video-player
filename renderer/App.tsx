import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { PlayerStage } from "./components/PlayerStage";
import { ShortcutHelp } from "./components/ShortcutHelp";
import { HomeScreen } from "./components/home/HomeScreen";
import { ToastHost, useToasts } from "./components/common/Toast";
import { useAppCommands } from "./hooks/useAppCommands";
import { useEffectSettings } from "./hooks/useEffectSettings";
import { JobHost } from "./components/JobHost";
import { useFeatureCommands } from "./hooks/useFeatureCommands";
import { useJobs } from "./hooks/useJobs";
import { useFullscreen } from "./hooks/useFullscreen";
import { useIdleControls } from "./hooks/useIdleControls";
import { useOsd, useOsdControls } from "./hooks/useOsd";
import { useLibrary } from "./hooks/useLibrary";
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
import { partitionDrop } from "./utils/dropItems";

export function App() {
  const { items, push, dismiss: dismissToast } = useToasts();
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const { plan, initialTime, loading, openDialog, openRecent, openDropped, openLibraryItem, restartAt, onVideoError, close, queue } = usePlayQueue(videoRef, push);
  const library = useLibrary(push);
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
  const osd = useOsd();
  const osdControls = useOsdControls(player, queue, osd.show);
  const subs = useSubtitles(plan, useCallback((m: string) => push("error", m), [push]));
  const captureRef = useRef<(() => Promise<Blob>) | null>(null);
  const screenshot = useScreenshot({ videoRef, captureRef, plan, timeSec: player.time, notify: push });
  const jobs = useJobs(push);
  const features = useFeatureCommands({ notify: push, plan, player, videoRef, fx, jobs });
  const { commands, goHome } = useAppCommands({
    showOsd: osd.show, screenshot, toggleRemaining, toggleShortcuts, videoRef, plan, player, fs, fx, subs, queue, panels, notify: push, closeMedia: close, openDialog: () => void openDialog(),
    addFolder: library.addFolder, feature: features.commands,
  });
  usePlayerShortcuts(true, commands);
  useMenuCommands(commands);
  useResumePosition(plan, player.time);

  useEffect(() => { window.player.setPlaying(!!plan && !player.paused); }, [plan, player.paused]);
  useEffect(() => { panels.closeInfo(); if (plan) push("success", `Playing ${plan.info.name}`); }, [plan?.info.path]);
  const homeHandlers = useMemo(() => ({
    openRecent: (p: string) => void openRecent(p), openDialog: () => void openDialog(), openItem: (id: string) => void openLibraryItem(id),
    addFolder: library.addFolder, removeFolder: library.removeFolder, rescan: library.rescan,
  }), [openRecent, openDialog, openLibraryItem, library.addFolder, library.removeFolder, library.rescan]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    // A dropped subtitle while a video is open loads as subtitles; Shift+drop appends to the queue.
    if (files[0] && plan && isSubtitlePath(files[0].name)) return void subs.loadDropped(files[0]);
    if (!plan) { // home screen: folders join the library, video files play
      const split = partitionDrop(e.dataTransfer.items);
      library.addDropped(split.folders);
      files.splice(0, files.length, ...split.files);
    }
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
      {/* The window has a native frame; the strip only matters over the player, and on the home screen it would eat pointer events. */}
      {plan && <div className="drag-region" />}
      {plan ? (
        <PlayerStage
          videoRef={videoRef} captureRef={captureRef} plan={plan} initialTime={initialTime} visible={visible} player={osdControls.player} fullscreen={fs}
          subs={subs} fx={fx} queue={osdControls.queue} osd={osd.state} panels={panels} notify={push} onHome={goHome} onSeekStep={(dir) => (dir < 0 ? commands.seekBack : commands.seekForward)?.()} onVideoError={onVideoError}
          onAudio={(o) => restartAt(player.time, o)} onPip={() => togglePip(videoRef.current, push)}
          remaining={remaining} onToggleRemaining={toggleRemaining}
        />
      ) : (
        <HomeScreen fx={fx} library={library.snapshot} handlers={homeHandlers} active={!helpOpen} notify={push} />
      )}
      {loading && <div className="loading" role="status" aria-label="Loading"><div className="spinner" /></div>}
      {dragging && <div className="drop-overlay">{plan ? "Drop to play (hold Shift to add to queue)" : "Drop to play, or drop a folder to add it"}</div>}
      {helpOpen && <ShortcutHelp onClose={() => setHelpOpen(false)} />}
      {features.overlays.map((o, i) => <Fragment key={i}>{o}</Fragment>)}
      <ToastHost items={items} onDismiss={dismissToast}><JobHost jobs={jobs} resumeAt={() => player.time} /></ToastHost>
    </div>
  );
}
