import { useNavigate } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import { FolderOpen, Plus, Sparkles } from "lucide-solid";
import { adapter } from "../../lib/backend";
import { strings } from "../../lib/i18n/en";
import { sessionStore } from "../../lib/stores/session.store";
import { uiStore } from "../../lib/stores/ui.store";
import { isDesktop, pickFolder } from "../../lib/tauri/desktop";
import { logger } from "../../lib/utils/logger";
import { SessionList } from "../sessions/SessionList";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";

/** Sidebar: new session + open folder + session list with rich hover states. */
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

  /** Web folder pick via file manager — opens native picker then confirms full path. */
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
      // webkitdirectory is non-standard but widely supported (Chrome/Edge)
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
      // `cancel` is not universally fired; fallback to focus detection
      input.addEventListener("cancel", () => finish(null));
      window.addEventListener(
        "focus",
        () => setTimeout(() => {
          if (!done && (!input.files || input.files.length === 0)) {
            // User likely dismissed dialog without picking — keep dialog for manual entry
            // Don't auto-finish here; let the text dialog handle it. Just clean up.
            // We finish with null to trigger manual dialog.
            // Delay to avoid racing with onchange
            setTimeout(() => {
              if (!done) finish(null);
            }, 300);
          }
        }, 300),
        { once: true },
      );
      input.click();
    });
  }

  async function onOpenFolder() {
    if (isDesktop()) {
      const folder = await pickFolder();
      if (folder) await onNew(folder);
      return;
    }
    // Web: open file manager first, then show path dialog for server-absolute path
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

  return (
    <aside
      style="width:300px;min-width:300px;border-right:1px solid var(--border);background:var(--surface);display:flex;flex-direction:column;box-shadow:var(--shadow-sm)"
    >
      <div style="padding:14px;display:flex;flex-direction:column;gap:10px;border-bottom:1px solid var(--border);background:linear-gradient(180deg, var(--surface) 0%, var(--bg-subtle) 100%)">
        <Button
          variant="primary"
          size="lg"
          onClick={() => onNew()}
          disabled={creating()}
          loading={creating()}
          style="width:100%;justify-content:center;box-shadow:var(--shadow-glow)"
        >
          <Show when={!creating()} fallback={null}>
            <Plus size={16} />
          </Show>
          {strings.newSession}
        </Button>
        <button
          type="button"
          onClick={onOpenFolder}
          disabled={creating()}
          title={isDesktop() ? "Pick a folder with the native dialog" : "Enter a folder path for this session"}
          style="width:100%;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 14px;border-radius:12px;border:1px dashed var(--border);background:linear-gradient(180deg, var(--surface) 0%, var(--bg) 100%);color:var(--muted);font-size:13px;font-weight:700;cursor:pointer;transition:all var(--transition-fast);box-shadow:var(--shadow-sm)"
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--rudra-orange)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--rudra-orange)";
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,77,28,0.07)";
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)";
            (e.currentTarget as HTMLButtonElement).style.background = "linear-gradient(180deg, var(--surface) 0%, var(--bg) 100%)";
            (e.currentTarget as HTMLButtonElement).style.transform = "none";
          }}
        >
          <FolderOpen size={16} />
          Open Folder
          <Show when={!isDesktop()}>
            <span style="font-size:11px;opacity:0.7;font-weight:600">· in session</span>
          </Show>
        </button>
        <div style="display:flex;align-items:center;gap:8px;padding:2px 2px 0;color:var(--muted);font-size:11px;letter-spacing:0.06em;text-transform:uppercase;font-weight:600">
          <Sparkles size={12} />
          {strings.sessions}
        </div>
      </div>
      <div style="flex:1;overflow-y:auto;padding:8px" class="rudra-scroll">
        <SessionList />
      </div>
      <Dialog open={folderOpen()} title="Open folder in new session" onClose={() => setFolderOpen(false)} width="min(92vw,480px)">
        <div style="display:flex;flex-direction:column;gap:12px">
          <p style="margin:0;font-size:13px;color:var(--muted);line-height:1.5">
            {isDesktop()
              ? "Pick a folder — the session will be scoped to it."
              : "Folder picked via file manager — confirm the full absolute path the server can see, then create the session."}
          </p>
          <input
            value={folderPath()}
            onInput={(e) => setFolderPath(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onConfirmFolder();
            }}
            placeholder="C:\\path\\to\\project  or  /home/you/project"
            autofocus
            style="width:100%;box-sizing:border-box;padding:11px 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg);color:var(--fg);font-size:13px;font-family:inherit;outline:none;transition:border-color var(--transition-fast)"
            onFocus={(e) => ((e.currentTarget as HTMLInputElement).style.borderColor = "var(--rudra-orange)")}
            onBlur={(e) => ((e.currentTarget as HTMLInputElement).style.borderColor = "var(--border)")}
          />
          <p style="margin:0;font-size:11px;color:var(--muted)">
            Tip: in the desktop app this opens the native folder dialog directly. In the browser you pick a folder first, then confirm its server path here.
          </p>
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
