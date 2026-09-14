import { useNavigate } from "@solidjs/router";
import { useQueryClient } from "@tanstack/solid-query";
import { createSignal, onCleanup, onMount, type JSX } from "solid-js";
import { adapter } from "../../lib/backend";
import type { StreamState } from "../../lib/backend/types";
import { strings } from "../../lib/i18n/en";
import { subscribeAppEvents } from "../../lib/opencode/events";
import { messageStore } from "../../lib/stores/message.store";
import { sessionStore } from "../../lib/stores/session.store";
import { uiStore } from "../../lib/stores/ui.store";
import {
  checkForUpdates,
  isDesktop,
  onDesktopEvent,
  parseOpenTarget,
  pickFolder,
  takeStartupPath,
} from "../../lib/tauri/desktop";
import { downloadText, sessionFilename, sessionToMarkdown } from "../../lib/utils/export";
import { logger } from "../../lib/utils/logger";
import { CommandPalette, type CommandAction } from "../ui/CommandPalette";
import { Toast } from "../ui/Toast";
import { MemoryToast } from "../memory/MemoryToast";
import { initMemoryExtraction } from "../../lib/memory/autoExtract";
import { SettingsDialog } from "../../pages/Settings";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { TopBar } from "./TopBar";

/** App shell: top bar + sidebar + routed content. Holds the SSE subscription and global shortcuts. */
export function AppShell(props: { children: JSX.Element }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [streamState, setStreamState] = createSignal<StreamState>("closed");

  const activeID = () => sessionStore.state.activeID;

  async function newSession(directory?: string) {
    try {
      const session = await adapter.createSession({ title: strings.newSessionTitle, directory });
      sessionStore.addSession(session);
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      navigate(`/s/${session.id}`);
    } catch (err) {
      logger.error(err);
      uiStore.toast((err as Error).message, "error");
    }
  }

  /** Desktop: native folder picker → session scoped to that directory. */
  async function newSessionInFolder() {
    const directory = await pickFolder();
    if (directory) await newSession(directory);
  }

  /** Route a `rudra://` URL or folder path to a session. */
  async function openTarget(raw: string | null | undefined) {
    const target = parseOpenTarget(raw);
    if (!target) return;
    if (target.kind === "session") {
      navigate(`/s/${target.id}`);
    } else {
      await newSession(target.path);
    }
  }

  async function checkUpdates() {
    const status = await checkForUpdates();
    if (status.state === "uptodate") {
      uiStore.toast(`${strings.updateUptodate} (v${status.version ?? "?"})`, "success");
    } else if (status.state === "downloaded") {
      uiStore.toast(`${strings.updateDownloaded} (v${status.version ?? "?"})`, "success");
    } else {
      logger.warn(status.detail ?? strings.updateCheckFailed);
      uiStore.toast(
        status.detail === "desktop-only" ? strings.desktopOnly : (status.detail ?? strings.updateCheckFailed),
        "error",
      );
    }
  }

  function copyLink() {
    const id = activeID();
    if (!id) {
      uiStore.toast(strings.selectSession, "info");
      return;
    }
    const url = `${window.location.origin}/s/${id}`;
    void navigator.clipboard
      ?.writeText(url)
      .then(() => uiStore.toast(strings.copyLink, "success"))
      .catch((err: unknown) => uiStore.toast((err as Error).message, "error"));
  }

  function exportMarkdown() {
    const id = activeID();
    if (!id) {
      uiStore.toast(strings.selectSession, "info");
      return;
    }
    const session = sessionStore.state.sessions.find((s) => s.id === id);
    downloadText(sessionFilename(session, id), sessionToMarkdown(session, messageStore.messagesFor(id)));
    uiStore.toast(strings.exportMarkdown, "success");
  }

  async function stopStream() {
    const id = activeID();
    if (!id || !sessionStore.isBusy(id)) return;
    try {
      await adapter.abortSession(id);
    } catch (err) {
      logger.error(err);
      uiStore.toast((err as Error).message, "error");
    }
  }

  const actions = (): CommandAction[] => [
    { id: "session.new", title: strings.newSession, hint: "Ctrl+N", run: () => newSession() },
    ...(isDesktop()
      ? [
          { id: "session.new-folder", title: strings.newSessionInFolder, run: newSessionInFolder },
          { id: "app.check-updates", title: strings.checkForUpdates, run: checkUpdates },
        ]
      : []),
    { id: "nav.home", title: "Go to sessions", run: () => navigate("/") },
    { id: "nav.settings", title: strings.settings, run: () => uiStore.setSettingsOpen(true) },
    {
      id: "theme.toggle",
      title: `Theme: switch to ${uiStore.state.theme === "dark" ? strings.light : strings.dark}`,
      run: () => uiStore.setTheme(uiStore.state.theme === "dark" ? "light" : "dark"),
    },
    { id: "session.copy-link", title: strings.copyLink, run: copyLink },
    { id: "session.export", title: strings.exportMarkdown, run: exportMarkdown },
    { id: "session.stop", title: strings.stopStream, hint: "Esc", run: stopStream },
  ];

  onMount(() => {
    const unsubscribe = subscribeAppEvents(queryClient);
    const stopExtraction = initMemoryExtraction();
    const stopStreamWatch = adapter.subscribeToStreamState((s) => setStreamState(s));
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        uiStore.setPalette(!uiStore.state.paletteOpen);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        void newSession();
      }
    };
    window.addEventListener("keydown", onKey);
    // Desktop-only: tray, deep links, single-instance forwards, startup path.
    const cleanups = isDesktop()
      ? [
          onDesktopEvent("tray-new-session", () => void newSession()),
          onDesktopEvent<string>("rudra-open-url", (url) => void openTarget(url)),
          onDesktopEvent<string>("rudra-open-path", (path) => void openTarget(path)),
        ]
      : [];
    if (isDesktop()) void takeStartupPath().then((raw) => openTarget(raw));
    onCleanup(() => {
      window.removeEventListener("keydown", onKey);
      for (const fn of cleanups) fn();
      stopStreamWatch();
      stopExtraction();
      unsubscribe();
    });
  });

  return (
    <div style="display:flex;flex-direction:column;height:100%;background:var(--bg);color:var(--fg)">
      <TopBar />
      <div style="display:flex;flex:1;min-height:0">
        <Sidebar />
        <main style="flex:1;min-width:0;display:flex;flex-direction:column">{props.children}</main>
      </div>
      <CommandPalette
        open={uiStore.state.paletteOpen}
        actions={actions()}
        onClose={() => uiStore.setPalette(false)}
      />
      <SettingsDialog
        open={uiStore.state.settingsOpen}
        onClose={() => uiStore.setSettingsOpen(false)}
      />
      <StatusBar streamState={streamState()} />
      <Toast />
      <MemoryToast />
    </div>
  );
}
