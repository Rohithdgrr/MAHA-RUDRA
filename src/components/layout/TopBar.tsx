import { A } from "@solidjs/router";
import { Command, Settings, Wifi, WifiOff } from "lucide-solid";
import { strings } from "../../lib/i18n/en";
import { uiStore } from "../../lib/stores/ui.store";
import { Logo } from "../ui/Logo";

/** Top bar: brand, connection pill, command hint and settings with rich icons. */
export function TopBar() {
  const connection = () => uiStore.state.connection;
  const version = () => uiStore.state.serverVersion;
  const isConnected = () => connection() === "connected";
  const dot = () => (isConnected() ? "var(--success)" : connection() === "disconnected" ? "var(--danger)" : "var(--muted)");
  const label = () =>
    isConnected()
      ? `${strings.connected}${version() ? ` · v${version()}` : ""}`
      : connection() === "disconnected"
        ? strings.disconnected
        : strings.loading;

  return (
    <header
      style="display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid var(--border);background:var(--obsidian);box-shadow:0 1px 0 rgba(255,255,255,0.04) inset;position:sticky;top:0;z-index:10"
    >
      <A href="/" style="text-decoration:none;color:inherit;display:inline-flex;align-items:center" aria-label={strings.appName}>
        <Logo />
      </A>
      <div style="display:flex;align-items:center;gap:10px">
        <span
          style={`display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;padding:6px 10px;border-radius:999px;border:1px solid ${isConnected() ? "rgba(63,185,80,0.25)" : "var(--border)"};background:${isConnected() ? "rgba(63,185,80,0.08)" : "var(--surface)"};color:${isConnected() ? "var(--success)" : "var(--muted)"};transition:all var(--transition-fast)`}
          title={label()}
        >
          <span
            style={`width:8px;height:8px;border-radius:50%;background:${dot()};display:inline-block;box-shadow:0 0 8px ${dot()};animation:${isConnected() ? "rudra-pulse 2s infinite" : "none"}`}
          />
          <span style="display:inline-flex;align-items:center;gap:4px">
            {isConnected() ? <Wifi size={12} /> : <WifiOff size={12} />}
            {label()}
          </span>
        </span>
        <span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--muted);padding:6px 9px;border-radius:999px;background:var(--surface);border:1px solid var(--border)">
          <Command size={12} />
          K
        </span>
        <button
          type="button"
          onClick={() => uiStore.setSettingsOpen(true)}
          aria-label={strings.settings}
          style="width:36px;height:36px;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--muted);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:all var(--transition-fast)"
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = "var(--surface-hover)";
            el.style.color = "var(--fg)";
            el.style.borderColor = "var(--border-hover)";
            el.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = "var(--surface)";
            el.style.color = "var(--muted)";
            el.style.borderColor = "var(--border)";
            el.style.transform = "none";
          }}
        >
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
}
