# VCR OSD UI design

Date: 2026-11-18. Status: built on `feat/vcr-osd-ui`.

## Goal

Make the player chrome speak the same language as the home screen: a 90s VCR's blue on-screen menu. The control bar, its menus and a new transient on-screen display (OSD) are drawn as crisp DOM on top of the picture. Drawing the UI through the shader is a separate, later piece of work (`docs/2026-11-18-osd-through-shader-plan.md`).

References: `docs/element-examples/` (a VCR menu font and element sheet, and a MENU list with arrow cursors and PLAY / SP / counter).

## Decisions

- Always on. There is no theme switch; the old Archivo/amber control bar is replaced.
- Palette: the home screen's `--tv-*` colours. The player uses derived `--osd-*` roles (`tokens.css`, `color-mix` only, no new hex).
- Type: Press Start 2P (`--font-pixel`) at 8 or 16 px only (`--px-sm`, `--px-md`), all capitals, with a faint magenta/cyan fringe and a navy drop (`--osd-fringe`).
- Square corners, 2 px ink rules (`--osd-rule`).
- Scope: control bar, seek bar, volume, time/status, icons, the menus that open from the bar (speed, audio, subtitles, queue) and toasts. The effects panel, info panel and help overlay keep their current look.

## Elements

| Element | Reference | Built as |
|---|---|---|
| Pixel text, box, panel, inverted selection, dashed title rule | font sheet, `SP` / `AUTO` boxes, `---- MENU ----` | `styles/vcr.css` (`.vcr-text`, `.vcr-box`, `.vcr-panel`, `.vcr-inverted`, `.vcr-rule`) |
| Icons | `▶ ◀ ▲ ▼ ● ‖ ■ ▶▶ ◀◀ ⏏`, cassette | `common/Icon.tsx`: pixel-grid glyphs, `crispEdges`, same `IconName` API |
| Seek bar | BEGIN / END tape position bar with ticks and `▼` | `SeekBar` on a `Slider` variant: outlined box, solid fill, buffered band, ticks every 10 %, marker, labels |
| Volume | `▮▮▮▮----` segmented row | `VolumeControl`: 16 blocks on a `Slider`; muted shows `MUTE` inverted |
| Control bar | blue screen band | solid `--osd-panel` band, ink top rule, `PLAY` / `PAUSE` status and `H:MM:SS` counter |
| Menus | `➤` list cursor, inverted rows | blue panel, ink border, dashed rule header, `➤` on the selected row, yellow/navy focus |
| OSD | `PLAY`, `SP`, `0:00:03`, `VOLUME` bar | `VcrOsd`: status top-left in the title-safe area, volume bar bottom-centre |

## OSD behaviour

- Two independent slots: status (transport, speed, repeat, subtitle delay) and level (volume). A new message in a slot replaces the old one and restarts its timer. Status lasts about 2 s, volume 1.5 s.
- Logic is pure (`utils/osd.ts`, tested); `useOsd` holds one timeout for the next expiry. No per-frame work; the effect-off path is unchanged.
- Shown for keyboard shortcuts and for clicks on the bar. The subtitle-delay toast moves to the OSD; toasts stay for errors and "Playing …".
- `aria-hidden`: the sliders and buttons already announce their values.
- Reduced motion: no transitions.
