import { useRef, type RefObject } from "react";
import { useEffectChain } from "../hooks/useEffectChain";
import type { EffectDefinition, ParamValues } from "../shader/effects/types";

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  effect: EffectDefinition | null;
  values: ParamValues;
  sourceKey: string;
  onToggle: () => void;
  onFullscreen: () => void;
  onError: (e: Error) => void;
}

/** Renders the effect output over the stage; renders nothing (video shown directly) when there is no effect. */
export function ShaderCanvas({ videoRef, effect, values, sourceKey, onToggle, onFullscreen, onError }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffectChain({ canvasRef, videoRef, effect, values, sourceKey, onError });
  if (!effect) return null;
  return <canvas ref={canvasRef} className="shader-canvas" onClick={onToggle} onDoubleClick={onFullscreen} />;
}
