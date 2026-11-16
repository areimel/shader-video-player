import { useRef, type MutableRefObject } from "react";
import { useEffectChain } from "../hooks/useEffectChain";
import type { EffectDefinition, ParamValues } from "../shader/effects/types";
import type { FrameInput } from "../shader/gl/frameInput";

interface Props {
  /** Stable factory for the picture to draw (see useEffectChain). */
  makeInput: () => FrameInput | null;
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
export function ShaderCanvas({ makeInput, effect, values, sourceKey, startOffset, onToggle, onFullscreen, onError, captureRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffectChain({ canvasRef, makeInput, effect, values, sourceKey, startOffset, onError, captureRef });
  if (!effect) return null;
  return <canvas ref={canvasRef} className="shader-canvas" onClick={onToggle} onDoubleClick={onFullscreen} />;
}
