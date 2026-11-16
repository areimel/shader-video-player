import { useEffect, useState } from "react";
import type { RecentFile } from "../types/player";
import { Button } from "./common/Button";
import { Kbd } from "./common/Kbd";
import { HelpNote } from "./HelpNote";
import { Logo } from "./Logo";
import { RecentFiles } from "./RecentFiles";

interface Props {
  onOpen: () => void;
  onRecent: (path: string) => void;
}

export function EmptyState({ onOpen, onRecent }: Props) {
  const [recents, setRecents] = useState<RecentFile[]>([]);
  useEffect(() => { void window.player.getRecents().then(setRecents); }, []);

  return (
    <div className="empty">
      <main className="empty-main">
        <div className="monitor">
          <div className="tube dropzone" onClick={onOpen} role="button" tabIndex={0}
            aria-label="Drop a video here, or press Enter to open a file"
            onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) onOpen(); }}>
            <p className="tube-title">Drop a video to play it</p>
            <Button className="tube-open" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
              Open file <Kbd k="CmdOrCtrl+O" />
            </Button>
            <p className="formats">MP4, MKV, MOV, WebM, AVI and more</p>
          </div>
          <div className="nameplate">
            <Logo />
            <h1>Shader Video Player</h1>
          </div>
        </div>
        <RecentFiles items={recents} onOpen={onRecent} />
      </main>
      <HelpNote />
    </div>
  );
}
