import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import { EffectRenderer } from "../shader/gl/effectRenderer";
import type { EffectDefinition, ParamValues } from "../shader/effects/types";

interface Options {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  /** null = bypass: nothing is created and no loop runs. */
  effect: EffectDefinition | null;
  values: ParamValues;
  /** Changes when the <video> element or its source is replaced. */
  sourceKey: string;
  /** Plan start offset; changes only together with sourceKey (a restart yields a new stream URL). */
  startOffset: number;
  onError: (e: Error) => void;
  /** Filled with the renderer's capture function while an effect is active, null otherwise. */
  captureRef?: MutableRefObject<(() => Promise<Blob>) | null>;
}

function devicePixels(entry: ResizeObserverEntry): [number, number] {
  const box = entry.devicePixelContentBoxSize?.[0];
  if (box) return [box.inlineSize, box.blockSize];
  const dpr = window.devicePixelRatio || 1;
  return [entry.contentRect.width * dpr, entry.contentRect.height * dpr];
}

/** Owns the EffectRenderer lifecycle for the canvas. Everything GL lives in the renderer; this only wires it to React. */
export function useEffectChain({ canvasRef, videoRef, effect, values, sourceKey, startOffset, onError, captureRef }: Options): void {
  const rendererRef = useRef<EffectRenderer | null>(null);
  const valuesRef = useRef(values);
  const startOffsetRef = useRef(startOffset);
  const onErrorRef = useRef(onError);
  valuesRef.current = values;
  startOffsetRef.current = startOffset;
  onErrorRef.current = onError;

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!effect || !canvas || !video) return;
    let renderer: EffectRenderer;
    try {
      renderer = new EffectRenderer(canvas, video, effect, (e) => onErrorRef.current(e), startOffsetRef.current);
    } catch (e) {
      onErrorRef.current(e instanceof Error ? e : new Error(String(e)));
      return;
    }
    rendererRef.current = renderer;
    if (captureRef) captureRef.current = () => renderer.capture();
    renderer.setValues(valuesRef.current);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      const [w, h] = devicePixels(entry);
      renderer.resize(w, h);
    });
    observer.observe(canvas, { box: "device-pixel-content-box" });
    return () => {
      observer.disconnect();
      renderer.dispose();
      rendererRef.current = null;
      if (captureRef) captureRef.current = null;
    };
  }, [canvasRef, videoRef, effect, sourceKey, captureRef]);

  useEffect(() => { rendererRef.current?.setValues(values); }, [values]);
}
