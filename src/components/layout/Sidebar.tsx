import { useNavigate } from "@solidjs/router";
import { createSignal } from "solid-js";
import { FolderOpen, Plus } from "lucide-solid";
import { adapter } from "../../lib/backend";
import { strings } from "../../lib/i18n/en";
import { sessionStore } from "../../lib/stores/session.store";
import { uiStore } from "../../lib/stores/ui.store";
import { isDesktop, pickFolder } from "../../lib/tauri/desktop";
import { logger } from "../../lib/utils/logger";
import { SessionList } from "../sessions/SessionList";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";

/** Sidebar: New Session + Open Folder + recent sessions only (workspace/footer removed per request). */
export function Sidebar() {
  const navigate = useNavigate();
  const [creating, setCreating] = createSignal(false);

  async function onNew(directory?: string) {
    setCreating(true);
    try {
      const session = await adapter.createSession({ title: strings.newSessionTitle, directory });
      sessionStore.addSession(session);
      navigate(`/s/${session.id}`);
    } catch (err) {
      logger.error(err);
      uiStore.toast((err as Error).message, "error");
    } finally {
      setCreating(false);
    }
  }

  const [folderOpen, setFolderOpen] = createSignal(false);
  const [folderPath, setFolderPath] = createSignal("");

  function pickFolderViaBrowser(): Promise<string | null> {
    return new Promise((resolve) => {
      const anyWin = window as unknown as { showDirectoryPicker?: () => Promise<{ name: string }> };
      if (anyWin.showDirectoryPicker) {
        anyWin
          .showDirectoryPicker()
          .then((h) => resolve(h.name))
          .catch(() => resolve(null));
        return;
      }
      const input = document.createElement("input");
      input.type = "file";
      (input as unknown as { webkitdirectory: boolean }).webkitdirectory = true;
      input.multiple = true;
      input.style.display = "none";
      document.body.appendChild(input);
      let done = false;
      const finish = (value: string | null) => {
        if (done) return;
        done = true;
        input.remove();
        resolve(value);
      };
      input.onchange = () => {
        const files = input.files;
        if (files && files.length > 0) {
          const first = files[0] as File & { webkitRelativePath?: string };
          const rel = first.webkitRelativePath || first.name;
          const top = rel.split("/")[0] || rel.split("\\")[0] || first.name;
          finish(top);
        } else {
          finish(null);
        }
      };
      input.addEventListener("cancel", () => finish(null));
      input.click();
      setTimeout(() => {
        if (!done) finish(null);
      }, 60000);
    });
  }

  async function onOpenFolder() {
    if (isDesktop()) {
      const folder = await pickFolder();
      if (folder) await onNew(folder);
      return;
    }
    const picked = await pickFolderViaBrowser();
    if (picked) setFolderPath(picked);
    else setFolderPath("");
    setFolderOpen(true);
  }

  async function onConfirmFolder() {
    const dir = folderPath().trim();
    if (!dir) return;
    setFolderOpen(false);
    await onNew(dir);
  }

  const count = () => sessionStore.state.sessions.length;

  return (
    <aside class="sidebar">
      <div class="sidebar-top">
        <button type="button" class="new-session-btn" onClick={() => onNew()} disabled={creating()}>
          <Plus size={16} strokeWidth={2.5} />
          {creating() ? "Creating…" : "New Session"}
        </button>
        <button
          type="button"
          onClick={onOpenFolder}
          disabled={creating()}
          title={isDesktop() ? "Pick a folder with the native dialog" : "Enter a folder path for this session"}
          style="width:100%;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:9px 12px;border-radius:10px;border:1px dashed var(--border);background:var(--surface);color:var(--muted);font-size:12.5px;font-weight:600;cursor:pointer"
        >
          <FolderOpen size={14} />
          Open Folder
        </button>
      </div>
      <div class="sidebar-scroll rudra-scroll">
        <div class="side-h">
          <span>Recent Sessions</span>
          <span>{count() || 9}</span>
        </div>
        <SessionList />
      </div>
      <Dialog open={folderOpen()} title="Open folder in new session" onClose={() => setFolderOpen(false)} width="min(92vw,480px)">
        <div style="display:flex;flex-direction:column;gap:12px">
          <p style="margin:0;font-size:13px;color:var(--muted);line-height:1.5">
            Folder picked via file manager — confirm the full absolute path the server can see, then create the session.
          </p>
          <input
            value={folderPath()}
            onInput={(e) => setFolderPath(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onConfirmFolder();
            }}
            placeholder="C:\\path\\to\\project  or  /home/you/project"
            autofocus
            class="input"
          />
          <div style="display:flex;justify-content:flex-end;gap:10px">
            <Button variant="ghost" onClick={() => setFolderOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={onConfirmFolder} disabled={!folderPath().trim()}>
              <FolderOpen size={14} />
              Create session
            </Button>
          </div>
        </div>
      </Dialog>
    </aside>
  );
}
