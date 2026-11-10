# Contributing to Moyue

Thanks for taking the time to improve Moyue.

## Development setup

Prerequisites:

- Node.js 20+
- Rust stable
- Visual Studio C++ Build Tools with the **Desktop development with C++** workload
- WebView2 Runtime (preinstalled on most Windows 10/11 systems)

Install and run:

```bash
npm install
npm run tauri:dev
```

Build the frontend:

```bash
npm run build
```

Build the desktop application:

```bash
npm run tauri:build
```

## Project layout

- `src/components` — React UI (reader, shelf, categories, music, settings)
- `src/lib` — storage, TXT/EPUB parsing, category persistence
- `src-tauri/src/lib.rs` — Tauri entrypoint and music directory commands
- `src-tauri/capabilities` — Tauri window permissions
- `src-tauri/tauri.conf.json` — window, security, asset protocol and bundling config

## Pull requests

1. Keep changes focused and describe the user-facing behavior in the PR.
2. Run `npm run build` before submitting.
3. For Rust changes, run `cargo check --manifest-path src-tauri/Cargo.toml`.
4. Do not commit books, music, reading progress, app data, generated build output, or personal screenshots.
5. If a new Tauri capability is required, update `src-tauri/capabilities/default.json` and explain why.

## Code style

- TypeScript / React: two-space indentation, functional components.
- Rust: standard `rustfmt`, four-space indentation.
- Avoid adding large binary assets unless they are required at runtime.

## License

By contributing, you agree that your contributions are licensed under the MIT License.
