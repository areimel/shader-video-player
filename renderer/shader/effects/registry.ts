import { crtEffect } from "./crt";
import type { EffectDefinition } from "./types";

// Shared common chunks live in gl/commonChunks.ts (the engine owns them).
export const EFFECTS: EffectDefinition[] = [crtEffect];

export function getEffect(id: string): EffectDefinition | undefined {
  return EFFECTS.find((e) => e.id === id);
}
