# Player UI through the shader: planning doc

Date: 2026-11-18. Status: plan for a dedicated future session; nothing here is built.
Follows `feat/vcr-osd-ui`, which restyles the player controls as crisp DOM VCR on-screen-display (OSD) elements (`renderer/styles/vcr.css`, `VcrOsd.tsx`). That session ends with the UI on top of the picture. This one moves it under the effect, so the controls bar and the transient OSD get scanlines, curvature, mask, glow and halation, the way a real TV draws its own menu.

## Goal and non-goals

Goal: with an effect on, the player's video UI (controls bar, top bar, transient OSD: PLAY, volume bar, counter, seek position) is drawn into the same tube as the picture. It stays operable by pointer, keyboard and assistive tech.

Non-goals:
- Effect off. Crisp DOM stays exactly as `feat/vcr-osd-ui` leaves it, with no GL context and no per-frame work ("effect off means off").
- Panels and menus that need real text input or long lists: effects panel, info, queue, subtitle and track menus, shortcut help, toasts. They stay DOM over the glass. Only the controls bar, top bar and transient OSD move.
- Subtitles. They stay `SubtitleOverlay` (look the same on or off, per CLAUDE.md).
- Making the existing home screen path different. It is a `canvasInput` source and keeps working unchanged.
- A new effect or a change to any effect's tuned look when the overlay is empty.

## What exists today

- The engine draws from one `FrameInput` (`renderer/shader/gl/frameInput.ts`): `videoInput` for the player, `canvasInput` for the home screen. `VideoSource` (`videoSource.ts`) owns one texture, bound for every pass whose input is `"video"` (`passGraph.ts` `bindInputs`).
- Home screen: the whole screen is the 2D canvas, so the UI *is* the source and shares the picture's fit and overscan (`homeValues()` zeroes overscan and letterboxes). It cannot be reused as is: the player has a video as the source, and the UI must not scroll, crop or overscan with the video.
- Pointer: `EffectDefinition.pointerToSource(viewUv, values, env)` maps output uv to source uv (`effects/types.ts`; `crt/pointer.ts` mirrors `raster.frag` + `main.frag`, `vhs/pointer.ts` mirrors `frame.frag` + `main.frag`, both on `shared/tube/geometry.ts`). `HomeScreen.tsx` turns that into a logical point (`utils/home/pointer.ts`, `uvToLogical`) and `hitTest` finds the row.
- Render loop: `EffectRenderer` renders only when `dirty`, or while `input.playing()` and an animated parameter is non-zero (`renderPolicy.ts` `shouldRender`). Paused and clean is idle. Paused UI changes have no way to dirty it today except through the input's `onFrame`/`listen` events.
- VHS in-shader OSD: `vhs/glsl/osd.glsl` (+ `osd-font.glsl`) draws `PLAY`, SP/LP/EP, counter, and the camcorder date stamp as coverage in the *tape raster* inside `frame.frag`, so it passes through tapeH/tapeV, the composite signal pair and then the tube. Text only, fixed strings, integer-division glyph lookup (`precision highp int`).
- Tube space: everything before `main` runs in tube space at raster resolution (`d_virtualWidth` x `d_virtualLines` for CRT). Overscan is applied only where the raster pass samples the source.

## Options for compositing

### A. Overlay texture as a second sampler, merged in a tube-space pass
A second `FrameInput`-like source, the UI canvas (RGBA, premultiplied alpha), uploaded to its own texture. The pass graph gets a second named source ref `"overlay"` next to `"video"`. A shader merges it into the picture.
- Where: a new cheap tube pass `osdMerge` after `linearize` (inputs: previous pass + `uOverlay`), in `effects/shared/tube/pipeline.ts` (`tubePasses`) with `passes/osd-merge.frag`. It runs in tube space at raster resolution, which is where a real TV adds its character generator: after the signal is decoded, before the beam, glow and mask. The UI therefore gets scanlines, mask, bloom and curvature but not composite blur, dot crawl or tape wobble. A UI that dissolved into the composite signal would be unreadable.
- Why not in `linearize`: its output is the persistence feedback target (`max(linear, prev*decay)`), so a hidden OSD would ghost for the phosphor decay time. A separate pass keeps persistence about the picture only.
- Disabled when no overlay is shown: the engine already forwards a disabled pass's first input, so an empty overlay costs nothing per frame.
- VHS with the TV stage off: the tube passes do not run and `main.frag` draws flat. The overlay is merged in `main.frag` in that case (flat, over the fitted picture rectangle).
- Overlay coordinates are *display space* (the tube rectangle, uv 0..1 after curvature is undone), independent of the video: it does not move with fit mode, overscan or video aspect. The video's own pass still does `(tubeUv - 0.5) * (1 - overscan) / content + 0.5` on its source only.

### B. Composite canvas input: video + UI in one 2D canvas
`drawImage(video)` plus the UI into one canvas, then `canvasInput` as today.
- Pro: no engine change; the pointer map keeps working (the picture is the UI's coordinate space).
- Con: the UI would share the video's fit, crop and overscan, so title-safe margins would depend on the video aspect and the CRT overscan would crop it. Every presented frame becomes a `drawImage` plus a canvas upload, which can block on GPU readback for hardware-decoded video and loses `requestVideoFrameCallback` frame pacing, 10-bit/HDR handling and the cheap direct `texSubImage2D(video)` path. UI changes force a full picture re-upload. Worse at 4K, which is unmeasured (Known gaps). Rejected.

### C. Draw the OSD in GLSL
Extend `osd.glsl` into a general widget renderer driven by uniforms.
- Pro: crisp at any raster, no second texture, no upload.
- Con: every control, label and bar needs a shader implementation with integer-heavy glyph lookups (the Mesa ACO `mediump` int-division crash is already a documented hazard), strings must be passed as uniforms (`every uniform a float`), localisation and long file names are painful, and layout would be duplicated between GLSL and the DOM. Fine for a handful of fixed strings (what VHS does), wrong for a controls bar. Kept only for the VHS VCR/camcorder text (see below).

### Recommendation: A
It is the only option that keeps the UI independent of the video's geometry, adds nothing to the video upload path, can be idle, and reuses what the home screen proved: a 2D canvas painted from a pure draw list (`layout()` + `painter.ts`), uploaded by a `canvasInput`-shaped object. The cost is one more sampler and one more pass in the shared tube pipeline, which both CRT and VHS get for free.

## Design

### UI model and painter (pure first)
- New `renderer/utils/osd/` (pure, unit-tested): `model.ts` (controls and OSD state to rows/widgets), `layout.ts` (state to a draw list plus hit regions in logical units, like `utils/home/layout.ts`), `hit.ts`, `state.ts` (hover/focus/pressed, reducer). The `utils/osd.ts` reducer from `feat/vcr-osd-ui` (messages, expiries, `formatCounter`) is reused as the input to `model.ts`, not rewritten.
- Painter: reuse `components/home/painter.ts` primitives (draw list ops, `readColors` from the `--tv-*` / `--osd-*` tokens, `fontSpec`); no hex outside `tokens.css`. If the op set is the same, move the shared part to `renderer/components/ui2d/` rather than copy it (DRY).
- `hooks/useOsdPaint.ts`, mirroring `useHomePaint`: paint on model change only, skip when `sameOps`, nothing before the pixel fonts load, timers only while the window is active.

### FrameInput contract changes
- `FrameInput` stays the picture contract. Add an optional second contract, not a field on `FrameInput`:
  ```ts
  export interface OverlayInput {
    readonly image: TexImageSource;        // origin-clean 2D canvas, premultiplied alpha
    size(): Size | null;
    visible(): boolean;                     // false = empty: pass disabled, nothing uploaded
    subscribe(onChange: () => void): () => void;  // fires after a repaint (one upload per paint)
  }
  ```
  `canvasInput` is nearly this already; factor its paint/size/ready part into a base (`painted()`, `size`, `ready`, subscribe set) and let the home source add the 30 Hz tick and `playing()` clock on top. The overlay has no clock and is never `playing()`.
- `createPipeline` / `EffectRenderer` take an optional `overlay?: OverlayInput`. New `OverlaySource` next to `VideoSource` (or one `TextureSource` class both use; `VideoSource` keeps its name for the `"video"` ref): texture, `uploadIfChanged()`, no mips, `LINEAR` filter, `CLAMP_TO_EDGE`, `UNPACK_PREMULTIPLY_ALPHA_WEBGL` set for that upload only.
- `PassSpec.inputs` (`passTypes.ts`) accepts `"overlay"` (`parseSourceRef` and `validatePasses` in `passPlan.ts` learn it; a pass using it must be able to be disabled). `passGraph.bindInputs` binds the overlay texture and `uOverlaySize`. A pass that reads `"overlay"` with no overlay supplied is disabled, not an error.
- `ShaderCanvas` and `useEffectChain` take `makeOverlay` next to `makeInput`; `PlayerStage.tsx` supplies it (the player), `HomeScreen` does not (the home screen draws its UI as the source, unchanged).
- Pointer: each effect gets a second, required method, `pointerToDisplay(viewUv, values, env)`, returning display-space uv (the tube rectangle after un-curving) or null. For CRT it is `viewToTubeUv(...)` from `shared/tube/geometry.ts`, the first half of what `crtPointerToSource` already does (split it, so both share it); for VHS, tube on: the same; tube off: the flat fit rectangle. The generic check in `tests/effects/definitions.test.ts` covers it like `pointerToSource`. Keep-in-step comments both ways with `shared/tube/glsl/geometry.glsl` and `main.frag`.

## Render policy impact

- Paused: a UI change (hover, a message appearing, the 2 s expiry, a focus ring) must render. The overlay `subscribe` callback calls `EffectRenderer.invalidate()`, same as `onFrame`. Final render on change, then idle; nothing else is added to `shouldRender` (it stays `dirty || (playing && animating)`).
- Playing: UI paints are event driven, so the overlay adds one canvas upload per UI change, not per video frame. Idle UI = no extra uploads and no extra draws beyond the picture's own.
- Seek bar playhead: the UI repaints when the visible counter second or the bar's pixel position changes (quantise to the bar's cell grid), at most about 4 Hz, never per video frame. Hold hover/drag repaints to `requestAnimationFrame`.
- Auto-hide: the controls bar hides after inactivity today. Hidden = `visible() === false` = the merge pass disabled, so a hidden UI costs the same as no UI. The expiry is one timeout, as in `useOsd` (no per-frame work).
- Effect off: `makeOverlay` is not called, the overlay canvas is not mounted, no paint timers run, and the DOM UI renders. `ShaderCanvas` unmounting already frees the GL context; the overlay canvas and its hook unmount with it. Do not keep both UIs painting: exactly one of DOM UI / overlay canvas is live at a time, switched by `fx.effect`.
- Context loss: `EffectRenderer.init()` rebuilds textures; the overlay source is rebuilt there and re-uploads from its canvas (the canvas still holds pixels).

## Resolution, scale and safe area

- Overlay canvas size matches the tube's raster, so one UI pixel is one raster pixel: the beam and mask act on real UI pixels, and Press Start 2P stays crisp. Use a logical grid like the home screen's (40x30 cells of 8 px at 320x240, drawn 2x to 640x480): choose the grid from the tube aspect (4:3 gives 320x240; 16:9 gives 427x240 or 480x270) and an integer scale so the raster height is an integer multiple of the logical height. `layout()` is pure and gets the logical size as input.
- The raster resolution (`d_virtualLines` etc.) changes with parameters. On a change of more than the rounding, repaint at the new size; otherwise sample the existing canvas with `LINEAR`. Open question: whether to pin one canvas size (480 lines) and resample, to avoid repaints while a slider is dragged (see Open questions).
- Title-safe: the picture's overscan does not apply to the overlay (display space), but curvature and the bezel do crop and bend the edges. Keep every widget inside a margin derived from the same tube parameters (`curvatureX/Y`, `cornerRadius`), the way a TV's OSD sits inside about 8 to 10 percent. Compute the margin in `utils/osd/layout.ts` from `values` via a small pure function in `shared/tube/derive.ts` with a unit test; the transient OSD uses the same 8 percent as `feat/vcr-osd-ui`.
- Controls bar: today it spans the window. Through the glass it is a bar inside the title-safe area, not edge to edge. Fullscreen on a 16:9 tube vs a 21:9 window: letterbox fit already bars the tube, so the UI follows the tube, not the window.
- Colour: the overlay is sRGB; the merge pass converts it with the same `toLinear(..., p_crtGamma)` as the picture so white is the same white. Brightness: `osdBrightness` param (declared once in `shared/tube/params.ts`, per the one-source rule) scales it so the UI is not washed out by mask loss.

## Pointer input through the glass

- The overlay element does not get hits. A transparent `<div>` above the canvas (like `HomeScreen`'s root) receives `pointermove`, `pointerdown`, `click`, `wheel`, and maps: `clientToUv` on the shader canvas, `effect.pointerToDisplay`, then `uvToLogical` (generalised to take the logical size), then `hitTest` on the last `layout()` hit regions.
- Only a real move moves hover (`isRealMove`, the home screen's rule: Chromium sends synthetic moves when the content under a resting pointer changes, which every UI repaint does).
- Pointer down on a hit region captures the pointer (seek bar drag, volume drag): keep the capture target on the transparent div and keep mapping until `pointerup`, including when the pointer leaves the bar or the glass.
- Outside any widget the event is passed through to the existing video click handling (play/pause on click, fullscreen on double click). Today `VideoView`/`ShaderCanvas` own those handlers; the hit layer must forward, not swallow. Wheel over the volume widget changes volume, elsewhere stays as now.
- Cursor: set the CSS cursor from the hit result (pointer over widgets, default elsewhere), and the auto-hide logic that today hides the cursor with the controls keeps working: pointer activity on the hit layer counts as activity.
- Curved edges: a point outside the glass or on the bezel maps to null, so edge clicks do nothing; the title-safe margin keeps real widgets away from there. Time-varying displacement (VHS wobble, tracking) is not mapped, same as the home screen. With heavy tape displacement a small widget can be off by a few pixels; give hit regions a small padding.

## Keyboard, focus and accessibility

- The real controls stay focusable DOM, not hidden decoration: a visually hidden `PlayerMirror` (like `HomeMirror`) holds the actual `<button>`s and `role="slider"` elements, in tab order, with the current labels, values and `aria-keyshortcuts`. Activating them runs the same handlers as today (`useAppCommands`). With the effect on, the DOM controls are `visually-hidden`, with the effect off they are the visible crisp UI: one set of elements, two presentations, so the accessibility tree is identical.
- Focus ring: the focused element drives a focus highlight painted on the overlay (inverted box, same token as the DOM `:focus-visible`), via `aria-activedescendant`-style state in the model (`state.focusId`). Roving focus is not needed; native Tab order is kept. `focusin`/`focusout` on the mirror repaint the overlay (this also fires while paused).
- `PlayerMirror` stays under the home-style rule: bounded, memoised, ids stable (`osd-<zone>-<id>`), so `SVP_CAPTURE_EVAL` can read the focused control the same way as `home-*`.
- Keyboard shortcuts are `COMMANDS` and unchanged; the mirror is not where they live. Home keys stay widget keys on the home root only.
- Transient OSD messages stay `aria-hidden` visually; their meaning is already announced by the slider/button state. The mirror carries a polite live region for the single most recent message when the effect is on (off: the DOM version of today).
- `prefers-reduced-motion`: no fades or marquee on the overlay; paint states, do not animate them.
- Screen magnification and high contrast: the overlay is a picture. If a user needs it, the effect-off DOM UI is the accessible fallback; a command (`toggleEffect`, `e`) already switches. Say so in the help text.

## Interaction latency

- Target: hover and press feedback within one display frame at 60 Hz. Path: pointer event, `hitTest` (pure), `layout()` (pure), canvas paint, upload, render. The first three are cheap; the upload of a ~640x480 RGBA canvas is the cost and happens once per change.
- Coalesce: paint at most once per `requestAnimationFrame`; the renderer's `invalidate()` already coalesces its draw into one rAF, so UI paint and draw land in the same frame if the paint runs first (call order matters: paint in the pointer handler, then `invalidate()`).
- During a drag, the playhead follows the pointer from the pure model immediately; the seek itself is debounced as today, and the video catches up. Do not wait for the video's `seeked` to paint the bar.
- Measure first (see Verification), then decide whether `OffscreenCanvas` or `texSubImage2D` on a dirty rectangle is worth it. Do not build either speculatively.

## Where the VHS camcorder/VCR OSD fits

- `vhs/glsl/osd.glsl` stays. It is the *recorder's* OSD: date stamp, tape speed, VCR counter, drawn in the tape raster and therefore smeared by the tape and signal passes, like a camcorder burn-in or a VCR's overlay recorded on the picture. It is part of the effect's look and depends on tape params (`p_osdMode`, `p_tapeSpeed`, date fields).
- The new overlay is the *TV's* OSD: the player UI, merged after decode. Different stage on purpose; they can show at once. Because both can draw `PLAY` and a counter, the VHS OSD modes and the player's transient OSD should not duplicate: when the player OSD is routed through the shader, the transient `PLAY`/counter popup is suppressed while `p_osdMode` is VCR (the tape already prints it), and shown otherwise. Decide the exact rule in the open questions.
- Reuse the glyph look, not the code: the overlay uses Press Start 2P in the 2D canvas; `osd-font.glsl` remains its own bitmap font (written from scratch, MIT). Do not merge them.
- Authentic variant for later (not in scope): a VCR preset could paint the player's UI at the tape raster before `tapeH` so it is smeared like the in-shader OSD. It is the same overlay with a different merge point, so keep the merge point a property of the pass graph (`osdMerge` placement in each effect's `pipeline.ts`), not hard-wired.

## Risks

- GPU process / Mesa: one more sampler and a full-raster pass. Keep `osdMerge` free of integer division and loops; any glyph work stays on the 2D canvas, so there is no new `highp int` exposure. Run `pnpm check:shaders` on the real GPU for every pass change. The merge pass is `enabled`-gated, so the common path (no overlay) is the old path.
- Float targets: the merge works on the same targets as `linearize` (needs the same `requiresFloat` the effects already declare); no new format. Premultiplied-alpha upload of a 2D canvas to a float sampler is fine (the source texture is RGBA8).
- Texture upload hazards: the overlay canvas must stay origin-clean (no remote images, only drawn text and rects); a failed upload turns the *overlay* off (DOM UI back) instead of the whole effect.
- Focus/AT regression: the biggest functional risk is losing the real focusable controls. The mirror plus tests (below) are the mitigation, built before the visual switch.
- Pointer drift: mapping error from curvature compounds with UI size; tests assert round trips through `pointerToDisplay` at the corners and edge-of-widget points, for both effects and tube on/off.
- Idle cost creep: the UI paints on timers (counter, expiry). All timers pause with `onWindowActivity`, and the overlay must show the same idle behaviour as the home screen (verified with a frame counter in devCapture).
- Fullscreen, DPR and window resize: raster-resolution canvases must follow `d_virtualLines`, not the window; check resize while paused.
- Moving existing DOM focus handling: `useDismiss` (Escape, outside click) and auto-hide use DOM events on the controls; a hit layer that swallows events breaks them. Phase 3 keeps DOM events on the mirror, the hit layer only adds pointer mapping.
- Parity drift between two presentations of the same controls (DOM vs painted): both come from one `model.ts`, and a test asserts each control has a painted op and a mirror element.

## Verification

- Pure units (vitest, no GL): `utils/osd/layout.ts` (draw list, inside the safe area for each tube aspect, no overlap), `hit.ts`, `state.ts` reducer, quantising of the playhead repaint, title-safe margin function, `pointerToDisplay` for CRT and VHS (round trips, null off the glass, tube on and off), `passPlan` accepts `"overlay"` and disables the pass when absent, `sameOps` skip.
- `tests/effects/definitions.test.ts`: generic `pointerToDisplay` check for every effect; `chunks.test.ts` covers the new chunk name.
- `pnpm check:shaders`: add the merge pass to `tests/shaders/compile-entry.ts` for both effects (overlay present and absent paths). Real-GPU gate before every commit that touches `.frag`.
- devCapture (`electron/devCapture.ts`): with `SVP_CAPTURE_KEYS` toggle the effect and open the controls; capture at 1920x1080 (scanlines fade below 2.5 output px per line) and crop with ffmpeg to inspect the mask on UI text. Read the mirror ids with `SVP_CAPTURE_EVAL` (focused control, hover state). Add an eval that logs the overlay upload count and render count over 5 s idle and 5 s paused-with-hover, expecting 0 after the last change.
- Manual (unverified until a person checks): hover and drag feel, focus ring visibility, screen reader pass on the mirror, 4K frame time, curvature extremes.
- Gates per CLAUDE.md: `pnpm typecheck && pnpm test && pnpm check:shaders`, exit status checked, no pipes.

## Phased implementation (suggested commits)

Each commit passes the gates on its own. Effect-on keeps the current DOM overlay until Phase 5, so every phase is shippable.

1. **Spike, no commit to main** (half a day): hack `osdMerge` into the CRT pipeline with a hard-coded canvas; check crispness at 1080p and 4K, frame time, and where the merge point looks right (after `linearize` vs inside `glow-h` input). Answers the open questions on resolution and merge point; throw the code away.
2. `Engine: overlay input and second texture source`: `OverlayInput`, `OverlaySource`, `"overlay"` source ref in `passPlan`/`passGraph`, optional `overlay` on `createPipeline`/`EffectRenderer`, renderer invalidates on overlay change. Tests for plan validation and disabled-when-absent; no effect uses it yet.
3. `Shader: osdMerge pass in the shared tube pipeline`: `shared/tube/passes/osd-merge.frag`, `tubePasses` placement, `osdBrightness` param, VHS flat-`main` merge, `pnpm check:shaders` both paths. Overlay absent = byte-identical output (add a note to the commit with a frame diff from devCapture).
4. `Pointer: pointerToDisplay`: split out of `crtPointerToSource`/`vhsPointerToSource`, add to `EffectDefinition`, generic test, `utils/home/pointer.ts` generalised to a logical size.
5. `OSD: pure UI model, layout and hit testing`: `utils/osd/*` with tests, fed by the `feat/vcr-osd-ui` reducer; no rendering yet.
6. `OSD: painter and useOsdPaint`: shared 2D painter extracted from `components/home/painter.ts` (home screen unchanged, its tests green), overlay `CanvasInput`-style source, hook with the paint rules from "Render policy".
7. `OSD: PlayerMirror and hit layer`: the focusable mirror, pointer mapping, event forwarding, cursor and auto-hide integration. Still invisible: DOM UI remains the one drawn.
8. `OSD: switch the player UI to the overlay when the effect is on`: `PlayerStage` mounts the overlay and hides the DOM presentation when `fx.effect` is set; effect off unchanged. devCapture comparison images added to the commit message.
9. `VHS: reconcile player OSD with tape OSD` (rule from open questions), `Docs:` update CLAUDE.md (layout, pipeline lines, rules), the shader design spec and `Known gaps`.

## Open questions

- Merge point: a separate `osdMerge` pass after `linearize` (this plan), or merged into the first glow/diffusion input to save a pass at 4K? Spike decides.
- Overlay canvas size: follow the raster (`d_virtualLines`, repaint on change) or pin 640x480 / 960x540 and resample (no repaint during slider drags, slightly softer)?
- Should the overlay get the composite signal's horizontal softness (a cheap blur in `osd-merge`, controlled by a param) or stay as crisp as the beam allows? A real TV OSD is sharper than the picture, but not pixel-perfect.
- Phosphor persistence on the UI: wanted as a subtle glow trail when the OSD disappears, or never (current plan: never)?
- Should the controls bar move into the tube at all, or only the transient OSD? A fully glass-bound controls bar changes the feel of everyday use (small targets near curved edges, hidden cursor). Option: transient OSD first, controls bar optional via a setting.
- VHS VCR mode: suppress the player's `PLAY`/counter popup (tape prints it) or always show both?
- A hit layer over the whole video swallows nothing today; is forwarding to `VideoView` click/double-click robust under the pointer-capture rules, or should the hit layer cover only the widgets' bounding boxes?
- Picture-in-picture and the screenshot command (`EffectRenderer.capture`): is the UI in a screenshot? Default proposal: no (an `includeOverlay` flag on `capture`, off), but PiP shows the plain video as now.
- Export (`feat/extra-features`): the offline renderer must never bake the overlay in; confirm the shared `createPipeline` is called without `overlay` there.
- Do we want authentic smeared-through-tape UI as a VCR preset option (see VHS section)?
