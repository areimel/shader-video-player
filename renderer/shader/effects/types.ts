import type { PassSpec, Size } from "../gl/passGraph";

export type ParamKind = "range" | "select" | "toggle";

/** Single source of truth for one effect parameter: drives uniforms, UI, presets and persistence. */
export interface ParamSpec {
  id: string;
  label: string;
  group: string;
  kind: ParamKind;
  default: number;
  min?: number;
  max?: number;
  step?: number;
  /** select only: the value is the option index. */
  options?: string[];
  unit?: string;
  /** A non-zero value keeps the render loop running between video frames. */
  animated?: boolean;
  hint?: string;
}

export type ParamValues = Record<string, number>;

export interface Preset {
  id: string;
  label: string;
  /** Overrides on top of the parameter defaults. */
  values: Partial<ParamValues>;
}

export interface DeriveEnv {
  viewport: Size;
  video: Size;
}

export interface EffectDefinition {
  id: string;
  label: string;
  params: ParamSpec[];
  groups: string[];
  presets: Preset[];
  /** Values computed from parameters and sizes, exposed to shaders as `d_<name>`. */
  derive(values: ParamValues, env: DeriveEnv): ParamValues;
  /** Maps a point on the output (viewport uv, origin top-left, 0..1) to source-picture uv (0..1), or null when it misses the picture. Ignores time-varying displacement. */
  pointerToSource(viewUv: { x: number; y: number }, values: ParamValues, env: DeriveEnv): { x: number; y: number } | null;
  passes: PassSpec[];
  /** Passes store signed or >1 values (RGBA8 is not enough): the effect refuses to start without float render targets. */
  requiresFloat?: boolean;
  /** Effect-local `#include` chunks, keyed by include name. */
  chunks: Record<string, string>;
}
