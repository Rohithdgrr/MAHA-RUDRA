import { useNavigate } from "@solidjs/router";
import { Clock, FolderOpen, Trash2 } from "lucide-solid";
import { Show } from "solid-js";
import { sessionStore } from "../../lib/stores/session.store";
import { uiStore } from "../../lib/stores/ui.store";
import { isDesktop, openInFileManager } from "../../lib/tauri/desktop";
import { formatTime } from "../../lib/utils/format";
import type { Session } from "../../lib/backend/types";

/** Single session row with rich hover, active glow and animated delete. */
export function SessionItem(props: { session: Session; onDelete: (id: string) => void }) {
  const navigate = useNavigate();
  const active = () => sessionStore.state.activeID === props.session.id;

  async function onReveal(e: MouseEvent) {
    e.stopPropagation();
    const dir = props.session.directory;
    if (!dir) {
      uiStore.toast("No folder for this session", "info");
      return;
    }
    const ok = await openInFileManager(dir);
    if (!ok) uiStore.toast("Could not open file manager", "error");
  }
  return (
    <div
      role="button"
      tabindex="0"
      onClick={() => {
        sessionStore.setActive(props.session.id);
        navigate(`/s/${props.session.id}`);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          sessionStore.setActive(props.session.id);
          navigate(`/s/${props.session.id}`);
        }
      }}
      style={`group:session; padding:11px 12px;border-radius:12px;cursor:pointer;display:flex;justify-content:space-between;gap:10px;align-items:center;transition:all var(--transition-fast);border:1px solid ${active() ? "rgba(255,77,28,0.25)" : "transparent"};background:${active() ? "linear-gradient(135deg, rgba(255,77,28,0.10), rgba(255,77,28,0.04))" : "transparent"};box-shadow:${active() ? "var(--shadow-sm)" : "none"}`}
      onMouseEnter={(e) => {
        if (!active()) (e.currentTarget as HTMLDivElement).style.background = "var(--surface-hover)";
      }}
      onMouseLeave={(e) => {
        if (!active()) (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
    >
      <span style="min-width:0;flex:1">
        <span
          style={`display:block;font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color var(--transition-fast);color:${active() ? "var(--fg)" : "var(--fg)"}`}
        >
          {props.session.title || "Untitled session"}
        </span>
        <span style="display:inline-flex;align-items:center;gap:6px;margin-top:3px;color:var(--muted);font-size:11px">
          <Clock size={11} />
          {formatTime(props.session.time.updated)}
          <Show when={active()} fallback={null}>
            <span style="width:6px;height:6px;border-radius:50%;background:var(--rudra-orange);display:inline-block;box-shadow:0 0 8px var(--rudra-orange)" />
          </Show>
        </span>
      </span>
      <span style="display:flex;align-items:center;gap:4px;flex-shrink:0">
      <Show when={isDesktop() && props.session.directory}>
        <button
          type="button"
          aria-label="Open folder in file manager"
          title={props.session.directory}
          onClick={onReveal}
          style="width:28px;height:28px;border-radius:8px;background:transparent;border:1px solid transparent;color:var(--muted);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all var(--transition-fast)"
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = "var(--surface-hover)";
            el.style.borderColor = "var(--border)";
            el.style.color = "var(--fg)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = "transparent";
            el.style.borderColor = "transparent";
            el.style.color = "var(--muted)";
          }}
        >
          <FolderOpen size={13} />
        </button>
      </Show>
      <button
        type="button"
        aria-label="Delete session"
        onClick={(e) => {
          e.stopPropagation();
          props.onDelete(props.session.id);
        }}
        style="width:28px;height:28px;border-radius:8px;background:transparent;border:1px solid transparent;color:var(--muted);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all var(--transition-fast)"
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.background = "rgba(248,81,73,0.1)";
          el.style.borderColor = "rgba(248,81,73,0.2)";
          el.style.color = "var(--danger)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.background = "transparent";
          el.style.borderColor = "transparent";
          el.style.color = "var(--muted)";
        }}
      >
        <Trash2 size={13} />
      </button>
      </span>
    </div>
  );
}
