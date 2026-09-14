import { useNavigate } from "@solidjs/router";
import { Braces, Bug, Code2, History, Trash2 } from "lucide-solid";
import { Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { sessionStore } from "../../lib/stores/session.store";
import type { Session } from "../../lib/backend/types";

function iconFor(title: string) {
  const t = (title || "").toLowerCase();
  if (t.includes("python") || t.includes("scraper")) return Braces;
  if (t.includes("memory") || t.includes("debug")) return Bug;
  if (t.includes("react") || t.includes("refactor")) return History;
  return Code2;
}

/** Mockup session row: icon + title + Active pill, orange left rail when active. */
export function SessionItem(props: { session: Session; onDelete: (id: string) => void; forceActive?: boolean }) {
  const navigate = useNavigate();
  const active = () => props.forceActive === true || sessionStore.state.activeID === props.session.id;
  const Icon = () => iconFor(props.session.title || "");

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
      class={`session-row ${active() ? "active" : ""}`}
    >
      <span class="s-icon">
        <Dynamic component={Icon()} size={15} />
      </span>
      <span class="s-title">{props.session.title || "Untitled session"}</span>
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
