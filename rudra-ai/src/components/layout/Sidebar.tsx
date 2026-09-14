import { useNavigate } from "@solidjs/router";
import { useQueryClient } from "@tanstack/solid-query";
import { createSignal } from "solid-js";
import { FolderOpen, Plus } from "lucide-solid";
import { createSessionAndGo } from "../../lib/session/actions";
import { sessionStore } from "../../lib/stores/session.store";
import { uiStore } from "../../lib/stores/ui.store";
import { isDesktop } from "../../lib/tauri/desktop";
import { strings } from "../../lib/i18n/en";
import { SessionList } from "../sessions/SessionList";

/** Sidebar: New Session + Open Folder + recent sessions. Folder dialog lives in AppShell. */
export function Sidebar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [creating, setCreating] = createSignal(false);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["sessions"] });

  async function onNew() {
    if (creating()) return;
    setCreating(true);
    try {
      await createSessionAndGo(navigate, invalidate);
    } finally {
      setCreating(false);
    }
  }

  const count = () => sessionStore.state.sessions.length;

  return (
    <aside class="sidebar">
      <div class="sidebar-top">
        <button type="button" class="new-session-btn" onClick={onNew} disabled={creating()}>
          <Plus size={16} strokeWidth={2.5} />
          {creating() ? strings.loading : strings.newSession}
        </button>
        <button
          type="button"
          onClick={() => uiStore.setFolderDialogOpen(true)}
          disabled={creating()}
          title={isDesktop() ? strings.folderPickNative : strings.folderEnterPath}
          style="width:100%;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:9px 12px;border-radius:10px;border:1px dashed var(--border);background:var(--surface);color:var(--muted);font-size:12.5px;font-weight:600;cursor:pointer"
        >
          <FolderOpen size={14} />
          {strings.openFolder}
        </button>
      </div>
      <div class="sidebar-scroll rudra-scroll">
        <div class="side-h">
          <span>Recent Sessions</span>
          <span>{count() || 9}</span>
        </div>
        <SessionList />
      </div>
    </aside>
  );
}
