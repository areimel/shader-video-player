import { useEffect, useRef, useState, type FormEvent } from "react";
import { looksLikeUrl } from "../utils/urlInput";
import { Button } from "./common/Button";
import { Panel, PanelHeader } from "./common/Panel";

interface Props {
  /** Starts the download; rejects with a readable message on failure. */
  onSubmit: (url: string) => Promise<void>;
  onClose: () => void;
}

/** Modal asking for a video page URL; the download then runs as a job card. */
export function OpenUrlDialog({ onSubmit, onClose }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = looksLikeUrl(value);

  useEffect(() => {
    input.current?.focus();
    let live = true;
    // Prefill from the clipboard when it is readable without a prompt; any failure just skips it.
    navigator.clipboard?.readText?.().then((t) => {
      if (live && looksLikeUrl(t)) { setValue((v) => v || t.trim()); input.current?.select(); }
    }, () => {});
    return () => { live = false; };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(value.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <div className="help-backdrop">
      <Panel className="open-url" role="dialog" aria-modal="true" aria-label="Open URL" onDismiss={onClose} dismissOutside>
        <form onSubmit={submit}>
          <PanelHeader title="Open URL" />
          <input ref={input} className="open-url-input" type="text" inputMode="url" spellCheck={false} autoComplete="off"
            placeholder="https://www.youtube.com/watch?v=…" aria-label="Video URL" value={value}
            onChange={(e) => { setValue(e.target.value); setError(null); }} />
          <p className="open-url-note">Downloads with yt-dlp to Videos/Shader Video Player</p>
          {error && <p className="open-url-error" role="alert">{error}</p>}
          <div className="open-url-actions">
            <Button variant="quiet" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!valid || busy}>{busy ? "Starting…" : "Download and play"}</Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
