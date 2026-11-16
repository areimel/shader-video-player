import type { HitTarget, HomeModel, RowAction } from "./types";

/** Everything a home row can do outside the screen itself. The library callbacks are optional. */
export interface HomeHandlers {
  openRecent: (path: string) => void;
  openDialog: () => void;
  openItem?: (itemId: string) => void;
  addFolder?: () => void;
  removeFolder?: (folderId: string) => void;
  rescan?: () => void;
}

/** The TV preset setting (useEffectSettings' setEffect / applyPreset). */
export interface TvSetting {
  setEffect: (id: string | null) => void;
  applyPreset: (presetId: string) => void;
}

export function runRowAction(a: RowAction, h: HomeHandlers, tv: TvSetting): void {
  switch (a.type) {
    case "setTv":
      tv.setEffect(a.effectId);
      if (a.effectId !== null && a.presetId !== null) tv.applyPreset(a.presetId);
      return;
    case "openRecent": return h.openRecent(a.path);
    case "openDialog": return h.openDialog();
    case "openItem": return h.openItem?.(a.itemId);
    case "addFolder": return h.addFolder?.();
    case "removeFolder": return h.removeFolder?.(a.folderId);
    case "rescan": return h.rescan?.();
  }
}

/** What a click on a row does: its action, except a folder header, which is only removed with Delete. */
export function clickAction(model: HomeModel, target: HitTarget): RowAction | null {
  const action = model.zones[target.zone][target.index]?.action;
  return action && action.type !== "removeFolder" ? action : null;
}
