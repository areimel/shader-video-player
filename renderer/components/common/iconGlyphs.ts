// Pixel-grid icon data: each glyph is rows of "X" (lit) and "." (dark) on a GRID x GRID cell.
// Glyphs with fewer than GRID rows are centred vertically by `glyphRows`.
export const GRID = 12;

export type Glyph = readonly string[];

const mirror = (g: Glyph): Glyph => g.map((r) => [...r].reverse().join(""));
const rot180 = (g: Glyph): Glyph => mirror([...g].reverse());
const overlay = (base: Glyph, top: Glyph, at: number): Glyph =>
  base.map((row, y) => {
    const t = top[y - at];
    return t ? [...row].map((c, x) => (c === "X" || t[x] === "X" ? "X" : ".")).join("") : row;
  });

const fwd: Glyph = [
  ".X....X.....",
  ".XX...XX....",
  ".XXX..XXX...",
  ".XXXX.XXXX..",
  ".XXX..XXX...",
  ".XX...XX....",
  ".X....X.....",
];

const skipNext: Glyph = [
  ".X...X....X.",
  ".XX..XX...X.",
  ".XXX.XXX..X.",
  ".XXXXXXXX.X.",
  ".XXX.XXX..X.",
  ".XX..XX...X.",
  ".X...X....X.",
];

const loopTop: Glyph = [
  "........X...",
  ".XXXXXXXXX..",
  ".X......X...",
  ".X..........",
  ".X..........",
  ".X..........",
];
const loop: Glyph = [...loopTop, ...rot180(loopTop)];

export const GLYPHS = {
  play: [
    "...X........",
    "...XX.......",
    "...XXX......",
    "...XXXX.....",
    "...XXXXX....",
    "...XXXX.....",
    "...XXX......",
    "...XX.......",
    "...X........",
  ],
  pause: Array(8).fill("..XXX..XXX.."),
  back10: mirror(fwd),
  fwd10: fwd,
  volume: [
    "....X....X..",
    "...XX.....X.",
    "XXXXX..X..X.",
    "XXXXX..X..X.",
    "XXXXX..X..X.",
    "XXXXX..X..X.",
    "...XX.....X.",
    "....X....X..",
  ],
  mute: [
    "....X.......",
    "...XX.......",
    "XXXXX..X...X",
    "XXXXX...X.X.",
    "XXXXX....X..",
    "XXXXX...X.X.",
    "...XX..X...X",
    "....X.......",
  ],
  fullscreen: [
    "XXXX....XXXX",
    "XX........XX",
    "X..........X",
    "X..........X",
    "............",
    "............",
    "............",
    "............",
    "X..........X",
    "X..........X",
    "XX........XX",
    "XXXX....XXXX",
  ],
  exitFullscreen: [
    "...X....X...",
    "...X....X...",
    "...X....X...",
    "XXXX....XXXX",
    "............",
    "............",
    "............",
    "............",
    "XXXX....XXXX",
    "...X....X...",
    "...X....X...",
    "...X....X...",
  ],
  pip: [
    "XXXXXXXXXXXX",
    "X..........X",
    "X..........X",
    "X..........X",
    "X.....XXXX.X",
    "X.....XXXX.X",
    "X.....XXXX.X",
    "X.....XXXX.X",
    "X..........X",
    "XXXXXXXXXXXX",
  ],
  info: [
    "XXXXXXXXXXXX",
    "X..........X",
    "X....XX....X",
    "X....XX....X",
    "X..........X",
    "X....XX....X",
    "X....XX....X",
    "X....XX....X",
    "X....XX....X",
    "X..........X",
    "X..........X",
    "XXXXXXXXXXXX",
  ],
  audio: [
    "....XXXXXX..",
    "....XXXXXX..",
    "....XX..XX..",
    "....XX..XX..",
    "....XX..XX..",
    "....XX..XX..",
    "..XXXX.XXXX.",
    "..XXXX.XXXX.",
  ],
  subtitles: [
    "XXXXXXXXXXXX",
    "X..........X",
    "X..........X",
    "X.XXXX.XXX.X",
    "X..........X",
    "X.XXX.XXXX.X",
    "X..........X",
    "X..........X",
    "XXXXXXXXXXXX",
  ],
  folder: [
    "XXXXX.......",
    "X...X.......",
    "XXXXXXXXXXXX",
    "X..........X",
    "X..........X",
    "X..........X",
    "X..........X",
    "X..........X",
    "XXXXXXXXXXXX",
  ],
  effects: [
    "..X......X..",
    "...X....X...",
    "....X..X....",
    "XXXXXXXXXXXX",
    "X..........X",
    "X.XXXXXX.X.X",
    "X.XXXXXX...X",
    "X.XXXXXX.X.X",
    "X.XXXXXX...X",
    "X..........X",
    "XXXXXXXXXXXX",
    "..XX....XX..",
  ],
  speed: [
    "....XXXX....",
    "..XX....XX..",
    ".X........X.",
    "X........X.X",
    "X.......X..X",
    "X......X...X",
    "X.....XX...X",
    "XXXX.XX.XXXX",
  ],
  skipNext,
  skipPrev: mirror(skipNext),
  queue: [
    "XXXXXXXXXXXX",
    "............",
    "XXXXXXXXXXXX",
    "............",
    "XXXXXXX.....",
    "............",
    "X...........",
    "XX..........",
    "XXX.XXXXXXXX",
    "XX..........",
    "X...........",
  ],
  back: [
    "...X........",
    "..XX........",
    ".XXXXXXXXXX.",
    "XXXXXXXXXXX.",
    ".XXXXXXXXXX.",
    "..XX........",
    "...X........",
  ],
  loop,
  loopOne: overlay(
    loop,
    [".....XX.....", "....XXX.....", ".....XX.....", ".....XX.....", ".....XX.....", "....XXXX...."],
    3,
  ),
  replay: [
    "...XXXXXX...",
    "..XX....XX..",
    "XXXXX....XX.",
    ".XXX......X.",
    "..X.......X.",
    "..........X.",
    ".X........X.",
    ".X........X.",
    "..XX....XX..",
    "...XXXXXX...",
  ],
  camera: [
    "...XXXX.....",
    "XXXXXXXXXXXX",
    "X..........X",
    "X...XXXX...X",
    "X..XX..XX..X",
    "X..X....X..X",
    "X..X....X..X",
    "X..XX..XX..X",
    "X...XXXX...X",
    "X..........X",
    "XXXXXXXXXXXX",
  ],
  keyboard: [
    "XXXXXXXXXXXX",
    "X..........X",
    "X.X.X.X.X..X",
    "X..........X",
    "X.X.X.X.X..X",
    "X..........X",
    "X..XXXXXX..X",
    "X..........X",
    "XXXXXXXXXXXX",
  ],
  close: [
    "XX........XX",
    ".XX......XX.",
    "..XX....XX..",
    "...XX..XX...",
    "....XXXX....",
    "....XXXX....",
    "...XX..XX...",
    "..XX....XX..",
    ".XX......XX.",
    "XX........XX",
  ],
} satisfies Record<string, Glyph>;

/** Pad a glyph to GRID rows (centred vertically). */
export function glyphRows(g: Glyph): string[] {
  const top = Math.floor((GRID - g.length) / 2);
  const blank = ".".repeat(GRID);
  return Array.from({ length: GRID }, (_, y) => g[y - top] ?? blank);
}

/** One path of horizontal runs, one unit-high rect per run, on the GRID x GRID cell. */
export function glyphPath(g: Glyph): string {
  let d = "";
  glyphRows(g).forEach((row, y) => {
    for (const m of row.matchAll(/X+/g)) d += `M${m.index} ${y}h${m[0].length}v1h-${m[0].length}z`;
  });
  return d;
}
