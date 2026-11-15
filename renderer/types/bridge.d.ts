import type { PlayerBridge } from "../../shared/types";

declare global {
  interface Window {
    player: PlayerBridge;
  }
}

export {};
