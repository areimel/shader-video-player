import { crtEffect } from "./crt";
import { vhsEffect } from "./vhs";
import type { EffectDefinition } from "./types";

// Shared common chunks live in gl/commonChunks.ts (the engine owns them).
export const EFFECTS: EffectDefinition[] = [crtEffect, vhsEffect];
