import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type WheelEvent } from "react";
import type { LibrarySnapshot } from "../../../shared/types";
import { useEffectChain } from "../../hooks/useEffectChain";
import type { EffectSettings } from "../../hooks/useEffectSettings";
import { useHomeMenu } from "../../hooks/useHomeMenu";
import type { HomeHandlers } from "../../utils/home/actions";
import { useHomePaint } from "../../hooks/useHomePaint";
import type { ToastKind } from "../../types/player";
import { homeValues } from "../../utils/home/effectValues";
import { mirrorId, mirrorStart } from "../../utils/home/frame";
import { wheelStep } from "../../utils/home/wheel";
import { hitTest, zoneAt } from "../../utils/home/hit";
import { clientToUv, containUv, isRealMove, LOGICAL, uvToLogical, type Point } from "../../utils/home/pointer";
import { HomeMirror } from "./HomeMirror";
import { SCALE } from "./painter";

const CANVAS = { width: LOGICAL.width * SCALE, height: LOGICAL.height * SCALE };

interface Props {
  fx: EffectSettings;
  library: LibrarySnapshot;
  handlers: HomeHandlers;
  /** False while an overlay owns the keyboard; the screen takes focus back when it turns true. */
  active: boolean;
  notify: (kind: ToastKind, msg: string) => void;
}

/**
 * The screen with no video open: a 640x480 canvas painted from the home layout, drawn through the active effect
 * (the 2D canvas is then only its source, kept out of view), or shown directly, pixelated, with the effect off.
 */
export function HomeScreen({ fx, library, handlers, active, notify }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const paintRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const menu = useHomeMenu(fx, library, handlers);
  const { frameRef, makeInput } = useHomePaint({ canvasRef: paintRef, model: menu.model, state: menu.state });

  // A failure here falls back to the flat screen for this visit; the user's effect setting is left alone.
  const [glFailed, setGlFailed] = useState(false);
  const toasted = useRef(false);
  const effect = glFailed ? null : fx.effect;
  const values = useMemo(() => (effect ? homeValues(effect, fx.values) : fx.values), [effect, fx.values]);
  const onError = useCallback((e: Error) => {
    console.error(e);
    setGlFailed(true);
    if (!toasted.current) notify("error", `Effect unavailable on the home screen: ${e.message.split("\n")[0]}`);
    toasted.current = true;
  }, [notify]);
  useEffectChain({ canvasRef: glRef, makeInput, effect, values, sourceKey: "home", startOffset: 0, onError });

  useEffect(() => { if (active) rootRef.current?.focus({ preventScroll: true }); }, [active]);

  /** Client position -> logical home pixel, through the glass when an effect draws the screen. */
  const toLogical = (e: { clientX: number; clientY: number }): Point | null => {
    const gl = glRef.current;
    if (effect && gl) {
      const view = clientToUv(e.clientX, e.clientY, gl.getBoundingClientRect());
      return uvToLogical(effect.pointerToSource(view, values, { viewport: { width: gl.width, height: gl.height }, video: CANVAS }));
    }
    const flat = paintRef.current;
    if (!flat) return null;
    const rect = flat.getBoundingClientRect();
    return uvToLogical(containUv(clientToUv(e.clientX, e.clientY, rect), rect, CANVAS));
  };
  const targetAt = (e: { clientX: number; clientY: number }) => {
    const p = toLogical(e);
    return p && frameRef.current ? hitTest(frameRef.current, p.x, p.y) : null;
  };

  const [pointing, setPointing] = useState(false);
  // Only a real move takes the cursor (see isRealMove), or the keyboard cursor would snap back to a resting mouse.
  const lastMove = useRef<{ x: number; y: number } | null>(null);
  const onPointerMove = (e: MouseEvent) => {
    const target = targetAt(e);
    setPointing(!!target);
    const real = isRealMove(lastMove.current, e);
    lastMove.current = { x: e.screenX, y: e.screenY };
    if (real && target) menu.dispatch({ type: "point", target });
  };
  const onClick = (e: MouseEvent) => {
    const target = targetAt(e);
    if (target) menu.activateAt(target);
  };
  const wheelAcc = useRef(0);
  const onWheel = (e: WheelEvent) => {
    const p = toLogical(e);
    const zone = p && zoneAt(p.x, p.y);
    if (!zone) return;
    const step = wheelStep(wheelAcc.current, e.deltaY, e.deltaMode);
    wheelAcc.current = step.acc;
    if (step.rows !== 0) menu.dispatch({ type: "wheel", zone, by: step.rows });
  };

  const zone = menu.state.zone;
  const row = menu.model.zones[zone][menu.state.cursor[zone]];
  return (
    <div
      ref={rootRef} className={pointing ? "home-screen is-pointing" : "home-screen"} tabIndex={0}
      role="application" aria-roledescription="home screen" aria-label="Home screen" aria-activedescendant={row?.action ? mirrorId(zone, row.id) : undefined}
      onKeyDown={menu.onKeyDown} onPointerMove={onPointerMove} onPointerLeave={() => setPointing(false)} onClick={onClick} onWheel={onWheel}
    >
      <canvas ref={paintRef} width={CANVAS.width} height={CANVAS.height} className={effect ? "home-canvas is-source" : "home-canvas"} aria-hidden="true" />
      {effect && <canvas ref={glRef} className="shader-canvas" aria-hidden="true" />}
      <HomeMirror
        model={menu.model} libraryStart={mirrorStart(menu.model.zones.library.length, menu.state.cursor.library)}
        tvStart={mirrorStart(menu.model.zones.tv.length, menu.state.cursor.tv)} updatesStart={mirrorStart(menu.model.zones.updates.length, menu.state.cursor.updates)}
      />
    </div>
  );
}
