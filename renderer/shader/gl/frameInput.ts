import type { Size } from "./passTypes";

/** `image: false` means only the presented-frame counter advances (no new pixels to upload). */
export interface FrameTick { image: boolean }

export interface FrameInputEvents {
  /** The picture jumped (a seek): reset feedback, upload, count it as a new frame. */
  onJump(): void;
  /** The intrinsic size changed or first data arrived: upload, refresh derived values. */
  onResized(): void;
  /** `playing()` flipped: schedule a render. */
  onPlayState(): void;
}

/**
 * What the effect engine draws: a <video> in the player, the home screen's 2D canvas on the menu.
 * The engine never looks at the element behind it, only at this interface.
 */
export interface FrameInput {
  /** Must be origin-clean, or the texture upload throws and the effect turns itself off. */
  readonly image: TexImageSource;
  /** Intrinsic size; null while unknown. Separate from `ready()` (a video knows its size before it can be uploaded). */
  size(): Size | null;
  /** A frame can be uploaded now. */
  ready(): boolean;
  /** Starts frame notifications; returns the function that stops them. */
  subscribe(onFrame: (tick: FrameTick) => void): () => void;
  /** Animated parameters only keep the render loop running while this is true. */
  playing(): boolean;
  /** Position in seconds, before the plan's start offset is added. */
  time(): number;
  listen(handlers: FrameInputEvents): () => void;
}

/** A canvas input: the owner calls `painted()` after it redraws the canvas. */
export interface CanvasInput extends FrameInput {
  painted(): void;
  dispose(): void;
}
