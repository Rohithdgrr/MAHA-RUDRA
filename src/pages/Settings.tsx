import { createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Check, Copy, Keyboard, Monitor, Moon, Palette, Server, Sun, X } from "lucide-solid";
import { strings } from "../lib/i18n/en";
import { uiStore } from "../lib/stores/ui.store";
import { getServerUrl } from "../lib/utils/env";
import { Button } from "../components/ui/Button";

function SettingsContent(_props: { onClose?: () => void }) {
  const theme = () => uiStore.state.theme;
  const [copied, setCopied] = createSignal(false);
  const serverUrl = () => getServerUrl();

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(serverUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  }

  return (
    <div style="display:flex;flex-direction:column;gap:20px">
      {/* Theme */}
      <section
        style="padding:16px;border:1px solid var(--border);border-radius:14px;background:linear-gradient(135deg, var(--surface) 0%, var(--bg-subtle) 100%);transition:all var(--transition-fast)"
      >
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <span style="width:32px;height:32px;border-radius:10px;background:var(--rudra-gradient);display:inline-flex;align-items:center;justify-content:center;color:white">
            <Palette size={16} />
          </span>
          <div>
            <h3 style="margin:0;font-size:13px;font-weight:700;letter-spacing:-0.01em">{strings.theme}</h3>
            <p style="margin:2px 0 0;font-size:11px;color:var(--muted)">Choose your workspace appearance</p>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <button
            type="button"
            onClick={() => uiStore.setTheme("dark")}
            style={`display:flex;align-items:center;gap:10px;padding:14px;border-radius:12px;border:1.5px solid ${theme() === "dark" ? "var(--rudra-orange)" : "var(--border)"};background:${theme() === "dark" ? "rgba(255,77,28,0.08)" : "var(--bg)"};cursor:pointer;transition:all var(--transition-fast);text-align:left`}
          >
            <span
              style={`width:36px;height:36px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;background:${theme() === "dark" ? "var(--rudra-orange)" : "var(--surface)"};color:${theme() === "dark" ? "white" : "var(--muted)"};border:1px solid ${theme() === "dark" ? "transparent" : "var(--border)"}`}
            >
              <Moon size={16} />
            </span>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:700">{strings.dark}</div>
              <div style="font-size:11px;color:var(--muted)">Midnight coding</div>
            </div>
            <Show when={theme() === "dark"}>
              <Check size={16} style="color:var(--rudra-orange)" />
            </Show>
          </button>
          <button
            type="button"
            onClick={() => uiStore.setTheme("light")}
            style={`display:flex;align-items:center;gap:10px;padding:14px;border-radius:12px;border:1.5px solid ${theme() === "light" ? "var(--rudra-orange)" : "var(--border)"};background:${theme() === "light" ? "rgba(255,77,28,0.06)" : "var(--bg)"};cursor:pointer;transition:all var(--transition-fast);text-align:left`}
          >
            <span
              style={`width:36px;height:36px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;background:${theme() === "light" ? "var(--rudra-orange)" : "var(--surface)"};color:${theme() === "light" ? "white" : "var(--muted)"};border:1px solid ${theme() === "light" ? "transparent" : "var(--border)"}`}
            >
              <Sun size={16} />
            </span>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:700">{strings.light}</div>
              <div style="font-size:11px;color:var(--muted)">Sacred ash</div>
            </div>
            <Show when={theme() === "light"}>
              <Check size={16} style="color:var(--rudra-orange)" />
            </Show>
          </button>
        </div>
      </section>

      {/* Server */}
      <section style="padding:16px;border:1px solid var(--border);border-radius:14px;background:var(--surface)">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <span style="width:32px;height:32px;border-radius:10px;background:var(--bg);border:1px solid var(--border);display:inline-flex;align-items:center;justify-content:center;color:var(--muted)">
            <Server size={16} />
          </span>
          <h3 style="margin:0;font-size:13px;font-weight:700">Server</h3>
          <span style="margin-left:auto;display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;padding:4px 8px;border-radius:999px;background:rgba(63,185,80,0.1);border:1px solid rgba(63,185,80,0.2);color:var(--success)">
            <span style="width:6px;height:6px;border-radius:50%;background:var(--success);display:inline-block;animation:rudra-pulse 2s infinite" />
            {uiStore.state.connection === "connected" ? strings.connected : strings.disconnected}
          </span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;background:var(--bg);border:1px solid var(--border)">
          <code style="flex:1;min-width:0;font-size:12px;color:var(--fg);word-break:break-all">{serverUrl()}</code>
          <Button variant="ghost" size="sm" onClick={copyUrl} style="flex-shrink:0;gap:6px">
            <Show when={copied()} fallback={<Copy size={13} />}>
              <Check size={13} />
            </Show>
            {copied() ? "Copied" : "Copy"}
          </Button>
        </div>
        <p style="margin:8px 0 0;font-size:11px;color:var(--muted);line-height:1.5">
          Change server URL from the Connect page. Desktop app auto-connects to the bundled sidecar.
        </p>
      </section>

      {/* Shortcuts */}
      <section style="padding:16px;border:1px solid var(--border);border-radius:14px;background:var(--surface)">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <span style="width:32px;height:32px;border-radius:10px;background:var(--bg);border:1px solid var(--border);display:inline-flex;align-items:center;justify-content:center;color:var(--muted)">
            <Keyboard size={16} />
          </span>
          <h3 style="margin:0;font-size:13px;font-weight:700">Keyboard shortcuts</h3>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          {[
            ["Ctrl / ⌘ + Enter", "Send prompt"],
            ["Ctrl / ⌘ + K", "Command palette"],
            ["Ctrl / ⌘ + N", "New session"],
            ["Esc", "Stop current stream"],
          ].map(([k, v]) => (
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 10px;border-radius:10px;background:var(--bg);border:1px solid var(--border)">
              <span style="font-size:12px;color:var(--fg);font-weight:500">{v}</span>
              <kbd style="font-size:11px;font-weight:700;padding:4px 8px;border-radius:7px;background:var(--surface);border:1px solid var(--border);border-bottom-width:2px;color:var(--muted);font-family:inherit;box-shadow:var(--shadow-sm)">
                {k}
              </kbd>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <div style="text-align:center;padding:8px 0 2px">
        <p style="margin:0;font-size:11px;color:var(--muted)">
          RUDRA AI · The storm that writes code. · v0.1.0
        </p>
      </div>
    </div>
  );
}

/** Page route: centered card with close → navigates home. Also usable as dialog content. */
export function Settings() {
  const navigate = useNavigate();
  return (
    <div style="flex:1;display:flex;align-items:flex-start;justify-content:center;padding:24px;background:radial-gradient(1200px 600px at 50% -20%, rgba(255,77,28,0.08), transparent 60%), var(--bg);overflow-y:auto" class="rudra-scroll">
      <div
        class="rudra-slide-up"
        style="width:min(640px,100%);background:var(--surface);border:1px solid var(--border);border-radius:18px;box-shadow:var(--shadow-lg);overflow:hidden"
      >
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 20px 14px;border-bottom:1px solid var(--border);background:linear-gradient(180deg, var(--surface) 0%, var(--bg-subtle) 100%)">
          <div style="display:flex;align-items:center;gap:12px">
            <span style="width:36px;height:36px;border-radius:12px;background:var(--rudra-gradient);display:inline-flex;align-items:center;justify-content:center;color:white;box-shadow:var(--shadow-glow)">
              <Monitor size={18} />
            </span>
            <div>
              <h1 style="margin:0;font-size:16px;font-weight:800;letter-spacing:-0.02em">{strings.settings}</h1>
              <p style="margin:2px 0 0;font-size:11px;color:var(--muted)">Workspace preferences</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => navigate("/")}
            style="width:32px;height:32px;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--muted);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:all var(--transition-fast)"
          >
            <X size={16} />
          </button>
        </div>
        <div style="padding:20px">
          <SettingsContent />
        </div>
      </div>
    </div>
  );
}

/** Dialog content for AppShell's modal. */
export function SettingsDialogContent() {
  return <SettingsContent />;
}
