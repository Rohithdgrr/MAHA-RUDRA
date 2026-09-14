import { uiStore } from "../../lib/stores/ui.store";

/** Diamond brand mark + wordmark + version pill — matches the mockup header. */
export function Logo() {
  const version = () => uiStore.state.serverVersion;
  return (
    <span style="display:inline-flex;align-items:center;gap:8px;min-width:0">
      <svg width="22" height="22" viewBox="0 0 28 28" aria-hidden="true" style="flex-shrink:0">
        <rect x="6.4" y="6.4" width="15.2" height="15.2" rx="3" transform="rotate(45 14 14)" fill="#1c1c22" />
        <rect x="8.6" y="8.6" width="10.8" height="10.8" rx="2" transform="rotate(45 14 14)" fill="none" stroke="#e8490f" stroke-width="2" />
        <rect x="11.4" y="11.4" width="5.2" height="5.2" rx="1" transform="rotate(45 14 14)" fill="#e8490f" />
      </svg>
      <span style="display:inline-flex;align-items:center;gap:7px;min-width:0">
        <span style="font-size:15px;font-weight:800;letter-spacing:0.02em;color:var(--fg)">
          RUDRA<span style="color:#e8490f;font-weight:800"> AI</span>
        </span>
        <span class="chip chip-orange" style="font-size:10px;padding:1px 7px;border-radius:999px">v{version() ?? "2.0"}</span>
      </span>
    </span>
  );
}
