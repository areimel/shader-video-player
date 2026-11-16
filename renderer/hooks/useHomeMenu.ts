import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import type { LibrarySnapshot, RecentFile } from "../../shared/types";
import { EFFECTS } from "../shader/effects/registry";
import { CHANGELOG } from "../utils/changelog";
import { CREDITS } from "../utils/credits";
import { buildModel } from "../utils/home/model";
import { activate, homeReducer, initialState, keyToAction } from "../utils/home/state";
import { clickAction, runRowAction, type HomeHandlers } from "../utils/home/actions";
import { libraryOrder, libraryRows } from "../utils/home/libraryRows";
import { useLatest } from "./useLatest";
import type { HitTarget, HomeAction, HomeModel, HomeState, RowAction } from "../utils/home/types";
import type { EffectSettings } from "./useEffectSettings";

export type { HomeHandlers };

export interface HomeMenu {
  model: HomeModel;
  state: HomeState;
  dispatch: (action: HomeAction) => void;
  /** Moves the cursor to a row and runs it (a click). */
  activateAt: (target: HitTarget) => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
}

const NO_RECENTS: RecentFile[] = [];
const EFFECT_ENTRIES = EFFECTS.map((e) => ({ id: e.id, label: e.label, presets: e.presets.map((p) => ({ id: p.id, label: p.label })) }));

/** Model, cursor state and row actions for the home screen. Painting lives in useHomePaint. */
export function useHomeMenu(fx: EffectSettings, library: LibrarySnapshot, handlers: HomeHandlers): HomeMenu {
  // null until loaded (see `touched` below).
  const [recents, setRecents] = useState<RecentFile[] | null>(null);
  useEffect(() => { void window.player.getRecents().then(setRecents, () => setRecents([])); }, []);

  const activeId = fx.effect?.id ?? null;
  const selectedId = fx.selected?.id ?? null;
  // Metadata patches keep the revision, the folder list and the item order: reuse the sort across them.
  const order = useMemo(() => libraryOrder(library), [library.revision, library.folders, library.items.length]);
  const shownRecents = recents ?? NO_RECENTS;
  const libRows = useMemo(() => libraryRows(library, shownRecents, order), [library, shownRecents, order]);
  const model = useMemo(() => buildModel({
    library, recents: shownRecents, effects: EFFECT_ENTRIES, changelog: CHANGELOG, credits: CREDITS,
    tv: { activeEffectId: activeId, selectedEffectId: selectedId, presetId: fx.presetId },
  }, libRows), [library, shownRecents, libRows, activeId, selectedId, fx.presetId]);

  // The state remembers the model it was computed for; a new model is synced during render, so no frame
  // is ever laid out with a cursor that belongs to the previous rows.
  // Until the user acts, a new model (recents, then the library, arrive after mount) starts the screen over, so
  // the cursor is at the top rather than wherever the rows that came first had put it. After that it is synced.
  const [held, setHeld] = useState(() => ({ model, state: initialState(model), touched: false }));
  let state = held.state;
  if (held.model !== model) {
    state = held.touched ? homeReducer(held.state, { type: "sync", prev: held.model, next: model }, model) : initialState(model);
    setHeld({ model, state, touched: held.touched });
  }

  const dispatch = useCallback((action: HomeAction) => {
    setHeld((h) => {
      const next = homeReducer(h.state, action, h.model);
      return next === h.state ? h : { ...h, state: next, touched: true };
    });
  }, []);

  const ref = useLatest({ fx, handlers, model, state });
  const run = useCallback((a: RowAction) => runRowAction(a, ref.current.handlers, ref.current.fx), [ref]);

  const activateAt = useCallback((target: HitTarget) => {
    dispatch({ type: "point", target });
    const action = clickAction(ref.current.model, target);
    if (action) run(action);
  }, [dispatch, run, ref]);

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const a = keyToAction(e.key, e.shiftKey, e.repeat);
    if (!a) return;
    const { model: m, state: s } = ref.current;
    const action = a === "activate" || a === "remove" ? activate(m, s, a) : null;
    if ((a === "activate" || a === "remove") && !action) return;
    // Handled here: keep it from the global shortcut layer (arrows are seek/volume there).
    e.preventDefault();
    e.stopPropagation();
    if (action) run(action);
    else dispatch(a as HomeAction);
  }, [dispatch, run, ref]);

  return { model, state, dispatch, activateAt, onKeyDown };
}
