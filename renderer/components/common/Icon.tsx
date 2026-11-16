const PATHS = {
  play: "M8 5v14l11-7z",
  pause: "M6 5h4v14H6zM14 5h4v14h-4z",
  back10: "M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z",
  fwd10: "M12 5V1l5 5-5 5V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z",
  volume: "M3 9v6h4l5 5V4L7 9zM16.5 12a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z",
  mute: "M3 9v6h4l5 5V4L7 9zM16 9l5 6m0-6l-5 6",
  fullscreen: "M5 5h5V3H3v7h2zM14 3v2h5v5h2V3zM5 14H3v7h7v-2H5zM19 19h-5v2h7v-7h-2z",
  exitFullscreen: "M8 3H6v3H3v2h5zM16 3h-2v5h5V6h-3zM3 16h3v3h2v-5H3zM14 14v5h2v-3h3v-2z",
  pip: "M19 7H5v10h14zM3 5h18v14H3zM11 11h7v5h-7z",
  info: "M11 7h2v2h-2zM11 11h2v6h-2zM12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z",
  audio: "M12 3v10.5a4 4 0 1 0 2 3.5V7h4V3z",
  subtitles: "M4 5h16v14H4zM7 10h4v2H7zM13 10h4v2h-4zM7 14h6v2H7z",
  folder: "M3 5h7l2 2h9v12H3z",
  effects: "M12 2l2.4 5.6L20 10l-5.6 2.4L12 18l-2.4-5.6L4 10l5.6-2.4zM19 15l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z",
  speed: "M12 4a9 9 0 0 0-9 9h2a7 7 0 0 1 14 0h2a9 9 0 0 0-9-9zM12 12l4-4",
  skipNext: "M6 18l8.5-6L6 6zM16 6h2v12h-2z",
  skipPrev: "M6 6h2v12H6zM9.5 12l8.5 6V6z",
  queue: "M3 6h13v2H3zM3 11h13v2H3zM3 16h7v2H3zM14 15v6l5-3z",
  back: "M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z",
  loop: "M7 7h10v3l4-4-4-4v3H5v6h2zM17 17H7v-3l-4 4 4 4v-3h12v-6h-2z",
  loopOne: "M7 7h10v3l4-4-4-4v3H5v6h2zM17 17H7v-3l-4 4 4 4v-3h12v-6h-2zM11 9.5v1h1.2V15H13.6V9z",
  replay: "M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z",
  camera: "M9 2 7.2 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3.2L15 2zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  keyboard: "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM5 8h2v2H5zM9 8h2v2H9zM13 8h2v2h-2zM17 8h2v2h-2zM5 12h2v2H5zM9 12h2v2H9zM13 12h2v2h-2zM17 12h2v2h-2zM8 15h8v2H8z",
  close: "M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={PATHS[name]} fillRule="evenodd" />
    </svg>
  );
}
