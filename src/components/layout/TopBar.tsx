import { A } from "@solidjs/router";
import { FolderOpen, Search, Settings, Sun, Moon } from "lucide-solid";
import { Show } from "solid-js";
import { sessionStore } from "../../lib/stores/session.store";
import { uiStore } from "../../lib/stores/ui.store";
import { Logo } from "../ui/Logo";

/** Top bar: brand + complete folder path (only up to opened folder) | search + theme + settings + avatar. */
export function TopBar() {
  const activeSession = () =>
    sessionStore.state.sessions.find((s) => s.id === sessionStore.state.activeID);
  const folderPath = () => activeSession()?.directory ?? "";
  const hasFolder = () => !!folderPath();
  const dark = () => uiStore.state.theme === "dark";

  return (
    <header class="topbar">
      <div class="tb-left">
        <A
          href="/"
          style="text-decoration:none;color:inherit;display:inline-flex;align-items:center;flex-shrink:0"
          aria-label="RUDRA AI home"
        >
          <Logo />
        </A>
        <Show when={hasFolder()}>
          <span class="tb-sep" />
          <span class="crumb" title={folderPath()} style="flex:1;min-width:0">
            <FolderOpen size={14} style="color:#cf3a12;flex-shrink:0" />
            <span class="crumb-title" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              {folderPath()}
            </span>
          </span>
        </Show>
      </div>
      <div class="tb-right">
        <button type="button" class="search-pill" onClick={() => uiStore.setPalette(true)} title="Search commands (Ctrl/⌘+K)" aria-label="Search commands">
          <Search size={15} class="sp-icon" />
          <span class="sp-text">Search commands…</span>
          <span class="sp-kbd">⌘K</span>
        </button>
        <button
          type="button"
          class="icon-btn"
          onClick={() => uiStore.setTheme(dark() ? "light" : "dark")}
          title={dark() ? "Switch to light" : "Switch to dark"}
          aria-label="Toggle theme"
        >
          {dark() ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        <button
          type="button"
          class="icon-btn"
          onClick={() => uiStore.setSettingsOpen(true)}
          aria-label="Settings"
          title="Settings"
        >
          <Settings size={16} />
        </button>
        <span class="avatar-chip" title="Rudra Agent">RA</span>
      </div>
    </header>
  );
}
