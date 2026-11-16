import { useRef, type MutableRefObject, type RefObject } from "react";
import { useEffectChain } from "../hooks/useEffectChain";
import type { EffectDefinition, ParamValues } from "../shader/effects/types";

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  effect: EffectDefinition | null;
  values: ParamValues;
  sourceKey: string;
  startOffset: number;
  onToggle: () => void;
  onFullscreen: () => void;
  onError: (e: Error) => void;
  /** Receives a function that captures the effect output as PNG (null while no effect is active). */
  captureRef?: MutableRefObject<(() => Promise<Blob>) | null>;
}

/** Renders the effect output over the stage; renders nothing (video shown directly) when there is no effect. */
export function ShaderCanvas({ videoRef, effect, values, sourceKey, startOffset, onToggle, onFullscreen, onError, captureRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffectChain({ canvasRef, videoRef, effect, values, sourceKey, startOffset, onError, captureRef });
  if (!effect) return null;
  return <canvas ref={canvasRef} className="shader-canvas" onClick={onToggle} onDoubleClick={onFullscreen} />;
}
