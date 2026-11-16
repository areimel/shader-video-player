# Repository Guidelines

## Project Structure & Module Organization

This Linux-first Electron player uses React, strict TypeScript, and WebGL2 effects.

- `electron/`: main process, preload bridge, IPC, media processing, and library indexing.
- `renderer/`: React components, hooks, styles, and utilities. Effects live in `shader/effects/`; reusable GPU infrastructure lives in `shader/gl/`.
- `shared/`: IPC types and central command/shortcut definitions.
- `tests/`: Vitest logic tests and the GPU shader compilation entry point.
- `scripts/`: development, bundling, and shader validation tools.
- `docs/`: specifications and screenshots; `fixtures/`: test media; `build/`: packaging assets.

Read `CLAUDE.md` for architecture guidance and the relevant specification under `docs/superpowers/specs/` before changing shader architecture.

## Build, Test, and Development Commands

Use Node 24 and the pnpm version pinned in `package.json`. Install `ffmpeg` and `ffprobe` on `PATH`.

- `pnpm install`: install dependencies.
- `pnpm dev`: start Vite, Electron bundling in watch mode, and Electron.
- `pnpm typecheck`: check renderer, tests, shared code, and Electron types.
- `pnpm test`: run Vitest once; target a file with `pnpm test tests/queue.test.ts`.
- `pnpm check:shaders`: compile every effect pass on a real GPU in a hidden Electron window.
- `pnpm build`: typecheck and produce renderer/main bundles.
- `pnpm dist`: build a Linux x64 `.deb` in `release/`.

## Coding Style & Naming Conventions

Follow existing TypeScript style: two-space indentation, double quotes, and semicolons. Use PascalCase for React components, camelCase for functions and variables, and `use*` names for hooks. Keep `App.tsx` focused on composition; place reusable logic in hooks or utilities. Define commands in `shared/commands.ts` and bridge contracts in `shared/types.ts`. No dedicated formatter or lint script is configured.

## Testing Guidelines

Name logic tests `tests/**/*.test.ts`, using Vitest `describe`, `it`, and `expect`. Cover behavior and edge cases; Vitest tests do not exercise GL. No coverage threshold is configured. Before committing, run `pnpm typecheck && pnpm test && pnpm check:shaders` and inspect exit statuses directly. Manually verify visual changes in the player.

## Commit & Pull Request Guidelines

History uses concise descriptive subjects, sometimes prefixed by area, such as `Home:` or `Docs:`. Follow that pattern. PRs should explain the problem, resulting behavior, and validation performed; link relevant issues and include screenshots for visual changes.
