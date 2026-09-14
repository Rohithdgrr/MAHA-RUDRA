# Changelog

## Phase 1 — Foundation & Server Connection

- Scaffolded SolidJS + TypeScript (strict) + Vite app with static `dist/` output.
- Added `BackendAdapter` seam: `src/lib/backend/types.ts`, `http-adapter.ts`
  (fetch + `@opencode-ai/sdk`, sole SDK/fetch owner), `tauri-adapter.ts`
  (Phase 4 stub), `index.ts` (auto-select via `isTauri()`).
- Added `Connect` page (server URL + basic auth, health-verified) with
  Tauri auto-connect bypass.
- Connect auto-probes `requiresAuth()` and auto-connects to open servers
  with zero credentials; auth form remains as fallback for protected servers.
- Added `AppShell` (Sidebar + TopBar + connection dot + RUDRA brand),
  `SessionList`/`SessionItem` via TanStack Query, `ChatView` with
  `MessageList`/`MessageBubble` (markdown) + `PromptInput` (Ctrl+Enter).
- Theming via CSS vars, dark default; all UI strings in `src/lib/i18n/en.ts`;
  `logger.ts` replaces `console.log`.
- Tests: env detection, markdown renderer, `HttpBackendAdapter` with mocked
  fetch, `PromptInput` component.

## Phase 2 — Real-time streaming (SSE)

- `HttpBackendAdapter.subscribeToEvents()` streams `GET /global/event` with
  the Basic-auth header: one multiplexed HTTP stream fanned out to many
  subscribers, with 3s reconnect and cleanup on last-unsubscribe/disconnect.
- Server `Event` payloads normalized via `toRudraEvent()`; ignored domain
  events (lsp, todo, pty, …) map to `undefined`.
- `message.store` live-patches `message.updated` /
  `message.part.updated` (text `delta` appended token-by-token, tool parts
  replaced wholesale) plus part/message removal; `session.store` tracks
  `statusBySession` (`busy`/`retry`/`idle`) and upserts sessions from events.
- New `src/lib/opencode/events.ts` fan-out (`handleRudraEvent`,
  `subscribeAppEvents`): stores patch live, queries invalidate on
  `session.created/deleted` and reconcile on `session.idle`. `AppShell`
  holds the single global subscription.
- `MessageBubble` renders every part type (text markdown, collapsible
  reasoning, tool cards with status/input/output, files, step cost/tokens,
  patches, agents, retries); `MessageList` sticky auto-scrolls with a
  streaming indicator; `ChatView` sends then relies on SSE + idle reconcile.
- Stop-the-turn: `abortSession()` (`POST /session/{id}/abort`) on Esc and a
  Stop button while streaming.
- Tests: SSE parser/normalizer unit tests, multiplexed fan-out over one
  mocked fetch connection with auth-header assertion, event-wiring tests
  (delta append, tool replace, busy→idle reconcile, upsert/remove).

## Phase 3 — Models, agents & command palette

- Model selection (follow-up to streaming): providers/models from
  `GET /config/providers`, `ModelPicker` dropdown, per-prompt `model`.
- Agents: `BackendAdapter.listAgents()` (`GET /agent`); `AgentPicker`
  merges server agents (passed as prompt `agent`) with local personas
  (Rudra/Explainer/Reviewer via prompt `system` override); persisted.
- Command palette (Ctrl/⌘+K): new session, navigation, theme toggle,
  copy session link, export transcript as Markdown, stop stream.
  Ctrl/⌘+N creates a session from anywhere.
- Markdown now sanitized with DOMPurify (scripts/handlers stripped).
- Theme preference actually persists: boot script + store init read
  `rudra.theme`, no light-flash.
- Tests: agent choice/resolution, palette filter, transcript export,
  sanitize assertions.

## Phase 4 — Tauri desktop shell

- Added `src-tauri/` (Tauri v2 + `@tauri-apps/plugin-shell`): `Cargo.toml`,
  `build.rs`, `tauri.conf.json` (`frontendDist: ../dist`, `devUrl:
  http://localhost:5173`, sidecar `externalBin: ["binaries/opencode"]` with
  `x86_64-pc-windows-msvc` triple, window 1280×860, CSP extended for
  `ipc://` + `127.0.0.1:4096`).
- Rust sidecar lifecycle in `src-tauri/src/main.rs`: `app.shell().sidecar
  ("opencode")` spawns `opencode serve --port 4096 --hostname 127.0.0.1
  --cors tauri://localhost --cors http://tauri.localhost --cors
  http://localhost:5173`, drains stdout/stderr, kills child on window close;
  `tauri-plugin-shell` initialized, `tray-icon` feature enabled.
- Generated app icons from `hero.png` via `npx tauri icon`; downloaded the
  upstream `opencode-windows-x64.zip` (v1.18.30) as
  `src-tauri/binaries/opencode-x86_64-pc-windows-msvc.exe` and verified
  `opencode --version` + `serve` health (`{"healthy":true,"version":"1.18.30"}`).
- `tauri-adapter.ts` now delegates to `HttpBackendAdapter` — the seam proven:
  same HTTP transport, only the server lifecycle differs.
- Added `npm run tauri` script and installed `@tauri-apps/api` +
  `@tauri-apps/plugin-shell`; `npx tauri info` and `npx tauri build`
  succeed (MSI + NSIS at `src-tauri/target/release/bundle/`).

## Phase 5 — Native polish (desktop only)

- Folder sessions (5.1): `BackendAdapter.createSession()` now passes
  `?directory=` to `POST /session`; `pick_workspace_folder` Tauri command
  (callback-bridged `dialog.pick_folder` → `tokio::oneshot`) + guarded
  `pickFolder()` bridge (`src/lib/tauri/desktop.ts`); `AppShell` "New
  session in folder…" action + palette entry (desktop-only) creates
  directory-scoped sessions. Web stays text-input-free.
- Tray (5.2): Rust `build_tray` — `New Session` (unminimize + focus +
  `tray-new-session` event), `Quit RUDRA` (kill sidecar + `app.exit(0)`),
  left-click toggles window visibility; `tray-icon` Cargo feature, menu
  event forwarding to frontend via `tray-new-session` listener.
- Notifications (5.3): `notify_turn_complete` command via
  `tauri-plugin-notification`; frontend records turn start on prompt
  (`notePromptSent`), and `events.ts` fires `maybeNotifyTurnComplete`
  on `session.idle` only when the turn exceeded 30s *and* the window is
  hidden (`document.hidden`) — desktop-only, web is a no-op.
- Updater (5.4): `tauri-plugin-updater` wired (`Builder::new().build()`),
  `check_for_updates` command (`check → download_and_install` →
  `rudra-update-installed` event), updater config in `tauri.conf.json`
  (`createUpdaterArtifacts` + `plugins.updater`); local unsigned builds
  run with `active: false` / `createUpdaterArtifacts: false` per
  "build without signing key" — flip to `true` + `pubkey` and set
  `TAURI_SIGNING_PRIVATE_KEY` to ship signed updates.
- Deep links + single-instance (5.5): `tauri-plugin-deep-link`
  (`rudra://` scheme, `register("rudra")`) + `tauri-plugin-single-instance`
  (`--port`/`--hostname`/`--cors` args whitelisted in
  `capabilities/default.json` `shell:allow-spawn` scope); Rust forwards
  `rudra://session/<id>` and `rudra://open?path=…` via
  `rudra-open-url`/`rudra-open-path` events; `single-instance` second
  launch focuses window + forwards target; `take_startup_path` one-shot
  command hands the first-launch arg to the frontend.
- File associations (5.6): CLI/folder-arg detection (`is_folder_arg` →
  existing `Path::is_dir()`), `startup_open_target()` harvests the first
  `rudra://` URL or folder arg, stored in `StartupState`, consumed once
  via `take_startup_path`; forwarded single-instance folder args also
  create directory-scoped sessions. Enables "Open with RUDRA" / terminal
  `rudra-ai C:\proj` flows.
- Desktop bridge (`src/lib/tauri/desktop.ts`): `isDesktop()` guard
  (`isTauri()`), `onDesktopEvent`/`invokeCmd` with web-safe no-op fallbacks
  (no Tauri runtime → no-ops, no bundle cost), `parseOpenTarget` and turn
  timing helpers pure and tested; all `@tauri-apps/api` imports are dynamic
  so the web build never pulls the Tauri runtime.
- Tests: `desktop.test.ts` (deep-link parsing, turn timing, web-safety),
  53/53 passing; `typecheck` clean; `tauri build` (MSI + NSIS) succeeds
  unsigned as requested.
