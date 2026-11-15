import { useEffect, useRef, type RefObject } from "react";
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
  onError: (e: Error) => void;
}

function devicePixels(entry: ResizeObserverEntry): [number, number] {
  const box = entry.devicePixelContentBoxSize?.[0];
  if (box) return [box.inlineSize, box.blockSize];
  const dpr = window.devicePixelRatio || 1;
  return [entry.contentRect.width * dpr, entry.contentRect.height * dpr];
}

/** Owns the EffectRenderer lifecycle for the canvas. Everything GL lives in the renderer; this only wires it to React. */
export function useEffectChain({ canvasRef, videoRef, effect, values, sourceKey, onError }: Options): void {
  const rendererRef = useRef<EffectRenderer | null>(null);
  const valuesRef = useRef(values);
  const onErrorRef = useRef(onError);
  valuesRef.current = values;
  onErrorRef.current = onError;

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!effect || !canvas || !video) return;
    let renderer: EffectRenderer;
    try {
      renderer = new EffectRenderer(canvas, video, effect, (e) => onErrorRef.current(e));
    } catch (e) {
      onErrorRef.current(e instanceof Error ? e : new Error(String(e)));
      return;
    }
    rendererRef.current = renderer;
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
    };
  }, [canvasRef, videoRef, effect, sourceKey]);

  useEffect(() => { rendererRef.current?.setValues(values); }, [values]);
}
