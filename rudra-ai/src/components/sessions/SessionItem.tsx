import { useNavigate } from "@solidjs/router";
import { Braces, Bug, Code2, History, Trash2 } from "lucide-solid";
import { Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { Session } from "../../lib/backend/types";
import { switchSession } from "../../lib/session/actions";
import { folderBasename } from "../../lib/session/folders";
import { sessionStore } from "../../lib/stores/session.store";

function iconFor(title: string) {
  const t = (title || "").toLowerCase();
  if (t.includes("python") || t.includes("scraper")) return Braces;
  if (t.includes("memory") || t.includes("debug")) return Bug;
  if (t.includes("react") || t.includes("refactor")) return History;
  return Code2;
}

/** Session row: icon + title + folder + Active pill, orange left rail when active. */
export function SessionItem(props: { session: Session; onDelete: (id: string) => void; forceActive?: boolean }) {
  const navigate = useNavigate();
  const active = () => props.forceActive === true || sessionStore.state.activeID === props.session.id;
  const Icon = () => iconFor(props.session.title || "");
  const folder = () => folderBasename(props.session.directory);

  function go() {
    if (props.forceActive) return;
    // Workspace owns activeID from the route — just navigate.
    switchSession(navigate, props.session.id);
  }

  return (
    <div
      role="button"
      tabindex="0"
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === "Enter") go();
      }}
      class={`session-row ${active() ? "active" : ""}`}
      title={props.session.directory || props.session.title || "Untitled session"}
    >
      <span class="s-icon">
        <Dynamic component={Icon()} size={15} />
      </span>
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px">
        <span class="s-title">{props.session.title || "Untitled session"}</span>
        <Show when={folder()}>
          <span
            style="font-size:10.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:ui-monospace,monospace"
            title={props.session.directory}
          >
            {folder()}
          </span>
        </Show>
      </span>
      <Show when={active()}>
        <span class="active-pill">Active</span>
      </Show>
      <span class="row-actions">
        <button
          type="button"
          aria-label="Delete session"
          onClick={(e) => {
            e.stopPropagation();
            props.onDelete(props.session.id);
          }}
          class="icon-btn"
          title="Delete session"
        >
          <Trash2 size={13} />
        </button>
      </span>
    </div>
  );
}
