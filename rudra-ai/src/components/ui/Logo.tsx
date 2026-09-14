import { uiStore } from "../../lib/stores/ui.store";

/** Brand mark + wordmark + version pill — matches the mockup header. */
export function Logo() {
  const version = () => uiStore.state.serverVersion;
  return (
    <span style="display:inline-flex;align-items:center;gap:8px;min-width:0">
      <img
        src="/brand/rudra-ai-desktop-icon.svg"
        width="22"
        height="22"
        alt=""
        aria-hidden="true"
        style="flex-shrink:0;border-radius:6px"
      />
      <span style="display:inline-flex;align-items:center;gap:7px;min-width:0">
        <span style="font-size:15px;font-weight:800;letter-spacing:0.02em;color:var(--fg)">
          RUDRA<span style="color:#e8490f;font-weight:800"> AI</span>
        </span>
        <span class="chip chip-orange" style="font-size:10px;padding:1px 7px;border-radius:999px">v{version() ?? "2.0"}</span>
      </span>
    </span>
  );
}
