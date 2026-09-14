# 🕉️ RUDRA AI — The storm that writes code.

A web-first, terminal-class AI coding workspace powered by a headless
[OpenCode](https://opencode.ai) server. RUDRA AI connects to `opencode serve`
over HTTP + SSE, streams agent responses token-by-token with live tool
visibility, and is architected so a future Tauri v2 desktop shell can adopt
it **without rewriting the frontend**.

> **Status:** Phases 1–5 implemented and verified (53/53 tests, clean
> typecheck, static `dist/` + MSI/NSIS desktop bundles). See
> [Phase-wise plan](#-phase-wise-plan).

---

## Table of contents

- [Problem statement](#-problem-statement)
- [Aim](#-aim)
- [Features](#-features)
- [Novel features](#-novel-features)
- [Architecture](#-architecture)
- [Tech stack](#-tech-stack)
- [Backend](#-backend-opencode-server)
- [API reference](#-api-reference)
- [UI/UX](#-uiux)
- [How it works](#-how-it-works-runtime-flow)
- [Workflow (user)](#-workflow-user)
- [Setup](#-setup)
- [Available scripts](#-available-scripts)
- [Project structure](#-project-structure)
- [Phase-wise plan](#-phase-wise-plan)
- [Future scope](#-future-scope)
- [Problematic areas (known issues)](#-problematic-areas-known-issues)
- [Risk factors](#-risk-factors)
- [Advantages](#-advantages)
- [Performance](#-performance)
- [Security](#-security)
- [Maintenance](#-maintenance)
- [References](#-references)
- [Datasets](#-datasets)

---

## 🧨 Problem statement

CLI-based AI coding agents (OpenCode, and tools like it) are powerful but
live in the terminal: no persistent multi-session workspace, no shareable
transcripts, no per-turn model/agent switching, no approachable surface for
developers who prefer GUI workflows. Existing web/desktop wrappers tend to
couple the UI directly to server internals, making them brittle against
server upgrades and non-portable to desktop shells.

RUDRA AI solves this with a **web-first client over the public OpenCode SDK
+ REST/SSE surface**, isolated behind a single `BackendAdapter` seam, so the
same frontend serves browsers today and a Tauri desktop shell tomorrow.

## 🎯 Aim

1. Connect to any `opencode serve` instance from the browser (local or remote).
2. Manage multiple coding sessions with real-time streaming responses and
   visible tool execution.
3. Steer every prompt at any configured provider/model and any server agent
   or local persona.
4. Stay portable: zero framework churn to wrap the app in Tauri later.
5. Ship with strict TypeScript, tests, and a static build (`dist/`).

---

## ✨ Features

### Connection & sessions

- **Connect page** (`/connect`): server URL + HTTP Basic auth, health-verified
  connect, anonymous `requiresAuth()` probe (401 vs 200), zero-credential
  auto-connect to open servers, Tauri auto-connect bypass.
- **Session CRUD**: list (TanStack Query), create, open (`/s/:id`), delete —
  with toasts and error boundaries.
- **Connection indicator** in TopBar (green/red dot + server version).

### Real-time chat

- **Token streaming** over multiplexed SSE (`GET /global/event`): text
  `delta`s append live; `session.idle` reconciles with server truth.
- **Full part rendering**: markdown text, collapsible reasoning, tool cards
  (status / input / output / error), file chips, step cost+tokens, patches,
  agent/subtask/retry notes.
- **Sticky auto-scroll** with a pulsing "RUDRA is working…" indicator.
- **Stop the turn**: `POST /session/{id}/abort` via Esc or the Stop button.
- **Optimistic-friendly send**: user message fetched immediately after
  `sendPrompt`; assistant deltas stream in via events.

### Model & agent control

- **Model picker**: every `provider · model` from `GET /config/providers`,
  persisted (`rudra.model`), sent per-prompt as `{ providerID, modelID }`.
- **Agent picker**: server agents from `GET /agent` (sent as prompt `agent`)
  plus local personas — Rudra, Explainer, Reviewer — applied through the
  prompt `system` override (work on any server). Persisted (`rudra.agent`).

### Platform

- **Command palette** (Ctrl/⌘+K): new session, navigation, theme toggle,
  copy session link, export transcript as Markdown, stop stream.
- **Shortcuts**: Ctrl/⌘+Enter send, Ctrl/⌘+N new session, Esc stop.
- **Export transcript** as Markdown download; **copy session link** to clipboard.
- **Theme**: dark default, light toggle, persisted (`rudra.theme`) with a
  pre-paint boot script (no flash).
- **Sanitized markdown** (marked + DOMPurify), toast system, centralized
  UI strings (`src/lib/i18n/en.ts`), leveled `logger` (no `console.log`).

## 💡 Novel features

- **The `BackendAdapter` seam**: components never touch fetch/SSE/SDK. The
  Tauri migration is an adapter swap, not a rewrite — the highest-leverage
  architectural decision in the project.
- **One SSE stream, many subscribers**: a single authenticated HTTP stream
  fanned out to all UI consumers, with reconnect and last-unsubscribe
  teardown. No per-component `EventSource` sprawl.
- **Raw-event → `RudraEvent` normalization** (`toRudraEvent`): the UI consumes
  a small discriminated union; unknown server domains are dropped, so server
  upgrades can't crash the client.
- **Per-message model + persona override**: most wrappers pin one default
  model; here every prompt can target a different provider/model/agent —
  which is also the practical workaround when a default provider key is broken.
- **Server-error transparency**: provider failures (e.g. invalid API key)
  surface inline in the transcript instead of a dead spinner.

---

## 🏗️ Architecture

```
Browser (SolidJS, static dist/)
│
├─ Components (ChatView, pickers, palette, shell)
│    │  never import SDK/fetch — only the adapter + helpers
│    ▼
├─ lib/opencode/*  (sessions, messages, models, agents, events fan-out)
├─ lib/stores/*    (session, message, ui — solid-js/store)
├─ lib/backend/BackendAdapter   ◄── THE SEAM
│      ├─ http-adapter.ts   (fetch + @opencode-ai/sdk, web)
│      └─ tauri-adapter.ts  (stub → Phase 4 sidecar)
│
└─ HTTP + SSE ──►  opencode serve :4096  (headless agent runtime + LLMs)
```

**State split**: server state in TanStack Query (`sessions`, `messages/:id`,
`providers`, `agents`); live/ephemeral state in `solid-js/store`
(`bySession` message cache patched by SSE, `statusBySession` busy map, theme,
toasts, palette). `session.idle` events invalidate queries to reconcile.

**Key files**

| Path | Role |
| --- | --- |
| `src/lib/backend/types.ts` | `BackendAdapter`, `RudraEvent`, `toRudraEvent`, shared SDK re-exports |
| `src/lib/backend/http-adapter.ts` | Sole fetch/SDK owner; SSE multiplex + reconnect |
| `src/lib/backend/tauri-adapter.ts` | Desktop adapter (delegates to HTTP, sidecar lifecycle in Rust) |
| `src/lib/opencode/events.ts` | `handleRudraEvent` / `subscribeAppEvents` + long-turn notify hook |
| `src/lib/opencode/models.ts`, `agents.ts` | Picker options + localStorage persistence |
| `src/lib/tauri/desktop.ts` | Desktop bridge (guarded, `parseOpenTarget`, turn timing) |
| `src/lib/stores/*` | session / message / ui stores |
| `src/components/chat/*` | ChatView, MessageList, MessageBubble, pickers, PromptInput |
| `src/components/ui/CommandPalette.tsx` | Palette + `filterActions` |
| `src/pages/*` | Connect, Workspace, Settings |

---

## 🧰 Tech stack

| Layer | Choice | Version |
| --- | --- | --- |
| Framework | SolidJS + strict TypeScript | `solid-js@1.9`, `typescript@6` |
| Build | Vite (static `dist/`, no SSR) | `vite@8` |
| Routing | `@solidjs/router` | `1.0` |
| Server state | `@tanstack/solid-query` | `5.102` |
| Client state | `solid-js/store` | built-in |
| Styling | Tailwind CSS + CSS variables | `tailwindcss@3.4` |
| OpenCode | `@opencode-ai/sdk` (public surface only) | `1.18` |
| Realtime | SSE over `fetch` stream (auth-header capable) | native |
| Markdown | `marked` + `dompurify` (`shiki` installed, wiring pending) | `18.0` / `3.4` |
| Icons | `lucide-solid` | `1.45` |
| Tests | `vitest` + `@solidjs/testing-library`, jsdom | `vitest@5` (53 tests) |
| Desktop | Tauri v2 + shell/dialog/notification/updater/deep-link/single-instance | `2.11` |
| Icons | `tauri icon` from `hero.png` | generated |

---

## 🔌 Backend (OpenCode server)

RUDRA AI ships **no backend** — it drives a manually started server:

```bash
opencode serve --port 4096 --cors http://localhost:5173
```

**Server-side prerequisites** (the most common failure class): the provider
that generates answers needs a valid key where the server runs — e.g.
`opencode auth login`, or the provider's key env var / `opencode.json`
config. A red `Missing or invalid API key…` bubble means the *server's*
provider key is missing, not a frontend bug; pick a working provider in the
Model picker.

**Endpoints consumed** (all via the adapter):

| Endpoint | Use |
| --- | --- |
| `GET /global/health` | Connect verify + auth probe (401 vs 200) |
| `GET /global/event` | Multiplexed SSE stream |
| `session.list/create/get/delete` | Sidebar session management |
| `session.messages` | Initial transcript load |
| `POST /session/{id}/message` (`prompt`) | Send (text + optional model/agent/system/tools) |
| `POST /session/{id}/abort` | Esc / Stop |
| `GET /config/providers` | Model picker |
| `GET /agent` | Agent picker |

---

## 📖 API reference

**`BackendAdapter`** (`src/lib/backend/types.ts`) — the only contract
components may program against:

```typescript
connect(config): Promise<void>;  disconnect(): void;  isConnected(): boolean;
listSessions(): Promise<Session[]>;            createSession(input): Promise<Session>;
getSession(id): Promise<Session>;              deleteSession(id): Promise<void>;
getMessages(sessionID): Promise<MessageWithParts[]>;
sendPrompt(input): Promise<void>;              // { sessionID, text, agent?, model?, system?, tools? }
abortSession(sessionID): Promise<void>;
listProviders(): Promise<ProviderList>;        listAgents(): Promise<Agent[]>;
subscribeToEvents(handler): Unsubscribe;       // multiplexed /global/event
health(): Promise<ServerHealth>;               requiresAuth(baseUrl): Promise<boolean>;
```

**`RudraEvent`** (discriminated union): `server.connected`, `session.created
/ .updated / .deleted / .status / .idle / .error`, `message.updated /
.removed`, `message.part.updated / .removed`, legacy `tool.execution.*`
aliases, `error`. Raw `Event` payloads map through `toRudraEvent()`.

**Helper modules**: `lib/opencode/{sessions,messages,models,agents,events,
client}`, `lib/utils/{env,markdown,format,export,logger}`, `lib/i18n/en`.

---

## 🎨 UI/UX

**Brand**: RUDRA AI · "The storm that writes code." · Rudra orange `#FF4D1C`
on obsidian `#1C1C22`, sacred ash `#F5F0E8`, success `#3FB950`, danger
`#F85149` — all via CSS vars, never hardcoded. Inter UI + JetBrains Mono
code. Dark default, light toggle. Voice: terse, technical.

**Layout**: TopBar (brand, connection dot + version, settings) → Sidebar
(New Session + session list) → routed content → Toasts. Pages: `/connect`,
`/` + `/s/:id` (Workspace), `/settings` (theme, server info, shortcuts).

**Chat**: Model/Agent toolbar → sticky auto-scrolling transcript (user right /
RUDRA left, timestamps, inline provider errors) → composer (Ctrl+Enter,
Send/Stop). Palette overlay for commands. All strings in `en.ts`.

---

## ⚙️ How it works (runtime flow)

1. **Connect**: probe `requiresAuth()` → `connect()` (Basic header) →
   `health()` → persist URL → route `/`.
2. **Open session**: query `getMessages` → cache in `messageStore`; AppShell's
   single SSE subscription fans `message.*` / `session.*` events into stores.
3. **Send**: `sendPrompt({ text, model?, agent?, system? })` → refetch (user
   bubble appears) → server streams `message.part.updated` (deltas append
   live, tool parts swap wholesale) under `session.status: busy`.
4. **Finish/abort**: `session.idle` (or abort) → mark idle → invalidate
   queries → transcript reconciles with server truth.
5. **Adapt**: Model/Agent picks persist locally and ride on every prompt;
   palette actions operate on the active session.

---

## 🧭 Workflow (user)

1. Start the server (`opencode serve … --cors …`) with a working provider key.
2. Open the app → auto-connects (or enter URL/credentials on `/connect`).
3. New Session → pick a **Model** and **Agent** → ask anything (Ctrl+Enter).
4. Watch tokens stream + tool cards update; **Esc/Stop** to interrupt.
5. Ctrl+K for commands (export Markdown, copy link, theme, navigation).

---

## 🚀 Setup

**Prerequisites**: Node 18+, npm, and an [OpenCode](https://opencode.ai)
install (`npm i -g opencode` or see the OpenCode docs) with at least one
authenticated provider (`opencode auth login`).

```bash
# Web mode — 1. Start the server (CORS must allow the dev origin)
opencode serve --port 4096 --cors http://localhost:5173

# 2. Install & run the app
npm install
npm run dev        # → http://localhost:5173

# Desktop mode — no manual server needed (sidecar bundled)
npm run tauri dev          # dev with sidecar
npx tauri build            # → MSI + NSIS in src-tauri/target/release/bundle/
# Unsigned local build: updater disabled (createUpdaterArtifacts: false).
# For signed updates: set TAURI_SIGNING_PRIVATE_KEY + enable updater in tauri.conf.json

# 3. (optional) password-protect the server, then use the same
#    username/password on the Connect page
export OPENCODE_SERVER_PASSWORD="…"
opencode serve --port 4096 --cors http://localhost:5173
```

Production preview: `npm run build && npm run preview` (serves static `dist/`).

## 📜 Available scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server (http://localhost:5173) |
| `npm run build` | `tsc -b` + static production build → `dist/` |
| `npm run preview` | Preview the production build |
| `npm run test` | `vitest run` (53 tests, 10 files) |
| `npm run test:watch` | Watch mode |
| `npm run typecheck` | Strict TS check, no emit |
| `npm run tauri dev` | Tauri dev (Vite + sidecar) |
| `npx tauri build` | Release build → MSI + NSIS |

---

## 🗂️ Project structure

```
rudra-ai/
├── src/
│   ├── App.tsx / index.tsx / router.tsx
│   ├── lib/backend/   types, http-adapter, tauri-adapter (delegates), index
│   ├── lib/opencode/  client, sessions, messages, models, agents, events
│   ├── lib/stores/    session.store, message.store, ui.store
│   ├── lib/tauri/     desktop.ts (guarded bridge)
│   ├── lib/utils/     env, markdown, format, export, logger
│   ├── lib/i18n/en.ts
│   ├── components/{layout,chat,sessions,ui}/
│   ├── pages/         Connect, Workspace, Settings
│   └── styles/globals.css
├── public/  index.html  vite.config.ts  tailwind.config.ts
├── src-tauri/  Cargo.toml, tauri.conf.json, src/main.rs (sidecar + tray +
│              dialog/notification/updater/deep-link/single-instance),
│              capabilities/default.json, binaries/opencode-*.exe,
│              icons/ (generated)
└── CHANGELOG.md  package.json  README.md
```

Conventions: adapter owns all I/O; UI consumes `RudraEvent`; strings in
`en.ts`; colors via CSS vars; `logger` over `console`; components < 200 lines.

---

## 📅 Phase-wise plan

- [x] **Phase 1 — Foundation & server connection**: scaffold, adapter seam,
  Connect, shell, sessions, non-streaming chat. *(shipped)*
- [x] **Phase 2 — Real-time streaming & tool visibility**: multiplexed SSE,
  live part patching, full part rendering, abort. *(shipped)*
- [x] **Phase 3 — Models, agents & command palette**: pickers, palette,
  shortcuts, export/copy-link, DOMPurify, theme persistence. *(shipped)*
- [x] **Phase 4 — Tauri desktop shell**: `src-tauri/` scaffold, sidecar
  lifecycle in Rust, `tauri-adapter` delegation, icons + bundled
  `opencode` binary, MSI/NSIS installers. *(shipped, unsigned build)*
- [x] **Phase 5 — Native polish**: native folder picker (directory-scoped
  sessions), tray (New Session + Quit, click toggle), OS notifications
  (>30s background turns), updater wiring + deep links (`rudra://`) +
  single-instance forwarding + file/folder associations (`rudra-ai
  C:\proj`). *(shipped, updater unsigned — see Setup)*
- Deferred: Projects + IndexedDB, MCP/plugin discovery page, custom-agent
  `AgentForm`, shiki highlighting, heartbeat + exponential backoff, gated
  integration test (`RUN_INTEGRATION=1`), `phase-N` git tags.

---

## 🔭 Future scope

Project-scoped workspaces UI + IndexedDB persistence (directory already
wired); MCP server discovery and enable/disable with tool counts;
user-defined agent personas (`AgentForm`); shiki code highlighting;
message attachments; multi-worktree support; collaboration (shared links,
comments); PWA packaging; signed auto-update feed
(`latest.json` + `TAURI_SIGNING_PRIVATE_KEY`); tray "Recent Sessions"
submenu; Windows file-association registry polish.

## ⚠️ Problematic areas (known issues)

- **Provider key errors surface as assistant messages** (by design, from the
  server) — confusing on first sight; the app could detect auth-error shapes
  and show a guided fix box.
- **Ctrl+N can't be overridden in Chrome** (browser-reserved); the shortcut
  works in Tauri/Firefox. Palette entry always works.
- **Reconnect is fixed 3s, not exponential**, and there's no heartbeat
  monitor yet — a dead-but-open stream can look idle.
- **No optimistic user bubble**: the message appears after the POST
  round-trip, not instantly.
- **Shiki installed but unwired**; code blocks render plain via marked.
- **No integration test** against a live server; no git history/tags in this
  snapshot.

## ☢️ Risk factors

- Tight coupling to OpenCode's evolving API (SDK `^1.18` may drift; the
  `RudraEvent` normalizer is the shock absorber — keep it strict).
- `opencode serve` must run with correct `--cors` + reachable host; remote
  deployments need auth + TLS discipline.
- Browser sandbox limits file/project workflows until Tauri lands.
- API keys live server-side; the web client must never collect provider keys.
- SSE over `fetch` (chosen for auth headers) bypasses `EventSource`
  auto-reconnect — hence the hand-rolled reconnect that must stay correct.

## ✅ Advantages

- Zero-install web client against local or remote servers.
- Portable by construction: one seam to desktop.
- Live, transparent agent execution (tokens + tools + cost).
- Per-prompt model/agent freedom; resilient to single-provider outages.
- Strict types, tested core (adapter, events, stores, utils), static hosting.

## 🚄 Performance

- Single SSE connection app-wide; delta appends are O(1) store patches
  (no transcript refetch mid-stream; one reconcile on idle).
- Queries cached with `staleTime` for providers/agents; no window-focus
  refetch storms (`retry: false`).
- Markdown renders per-part; long tool outputs truncated (2k chars) with
  capped scroll regions. Production bundle ≈ 218 kB JS (≈ 69 kB gzip).

## 🔒 Security

- Provider keys stay on the server; the client only handles optional
  HTTP Basic credentials for server access (stored in memory, never logged).
- All rendered markdown sanitized via DOMPurify (scripts/handlers stripped).
- Auth probe sends no credentials; password-whitespace warning on Connect.
- `requiresAuth`/health errors typed as `RudraError` with safe messages.

## 🛠️ Maintenance

- `CHANGELOG.md` per phase; run `test` + `typecheck` + `build` before any
  milestone (currently all green: 53/53, zero TS errors, MSI/NSIS built unsigned).
- Dependabot-style watch on `@opencode-ai/sdk` minors; re-verify
  `toRudraEvent` against new `Event` variants (unknowns are ignored by design).
- Backend rule stays absolute: no fetch/SDK/EventSource outside adapters.

---

## 🔗 References

- [OpenCode](https://opencode.ai) — the headless agent server this client drives.
- [sst/opencode on GitHub](https://github.com/sst/opencode) — server source,
  REST/SSE surface, SDK; start here to understand endpoints and auth.
- [OpenCode SDK (`@opencode-ai/sdk`)](https://www.npmjs.com/package/@opencode-ai/sdk) —
  the only server coupling allowed in this repo.
- [Tauri v2](https://github.com/tauri-apps/tauri) — planned desktop shell;
  [plugin-shell](https://github.com/tauri-apps/plugins-workspace) for the sidecar.
- [SolidJS](https://www.solidjs.com) · [Solid Router](https://github.com/solidjs/solid-router) ·
  [TanStack Query](https://tanstack.com/query/latest) · [Vite static deploy](https://vite.dev/guide/static-deploy.html)
- [marked](https://github.com/markedjs/marked) · [DOMPurify](https://github.com/cure53/DOMPurify) ·
  [Shiki](https://shiki.style) · [Lucide](https://lucide.dev) · [Tailwind CSS](https://tailwindcss.com)

## 🗃️ Datasets

**Not applicable.** RUDRA AI trains no models and ships no datasets — it is a
client over live LLM providers (via the OpenCode server). No dataset links,
collection, or versioning are required for this project. Evaluation is
behavioral (acceptance criteria per phase) rather than metric-based.

---

*Built phase by phase against the master build prompt. See `CHANGELOG.md`
for the per-phase delivery log.*
