import { useNavigate } from "@solidjs/router";
import { useQueryClient } from "@tanstack/solid-query";
import { createEffect, createSignal, Show } from "solid-js";
import { FolderOpen } from "lucide-solid";
import { strings } from "../../lib/i18n/en";
import {
  loadLastDirectory,
  normalizeDirectory,
  resolveFolderOpen,
} from "../../lib/session/folders";
import { openFolderSession, switchSession } from "../../lib/session/actions";
import { sessionStore } from "../../lib/stores/session.store";
import { uiStore } from "../../lib/stores/ui.store";
import { isDesktop, pickFolder } from "../../lib/tauri/desktop";
import { logger } from "../../lib/utils/logger";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";

/** Shared "open folder" dialog: native picker on desktop, server-visible path on web. */
export function FolderDialog() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [path, setPath] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const open = () => uiStore.state.folderDialogOpen;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["sessions"] });

  createEffect(() => {
    if (open()) setPath(loadLastDirectory());
  });

  const normalized = () => normalizeDirectory(path());
  const existingID = () => {
    const dir = normalized();
    if (!dir) return undefined;
    const decision = resolveFolderOpen(sessionStore.state.sessions, dir);
    return decision.action === "switch" ? decision.sessionID : undefined;
  };

  function close() {
    if (!busy()) uiStore.setFolderDialogOpen(false);
  }

  async function onPickNative() {
    const folder = await pickFolder();
    if (folder) setPath(folder);
  }

  async function onSubmit(forceNew = false) {
    const dir = normalized();
    if (!dir || busy()) return;
    setBusy(true);
    try {
      await openFolderSession(navigate, invalidate, dir, { forceNew });
      uiStore.setFolderDialogOpen(false);
    } finally {
      setBusy(false);
    }
  }

  function onSwitchToExisting() {
    const id = existingID();
    if (!id) return;
    switchSession(navigate, id);
    uiStore.setFolderDialogOpen(false);
  }

  async function onBrowse() {
    if (isDesktop()) {
      await onPickNative();
      return;
    }
    // Web has no real path API (showDirectoryPicker yields only a name), so
    // offer the file manager as a hint and let the user paste the
    // server-visible absolute path.
    try {
      const anyWin = window as unknown as { showDirectoryPicker?: () => Promise<{ name: string }> };
      if (anyWin.showDirectoryPicker) {
        const handle = await anyWin.showDirectoryPicker().catch(() => null);
        if (handle && !path().trim()) setPath(handle.name);
      } else {
        const input = document.createElement("input");
        input.type = "file";
        (input as unknown as { webkitdirectory: boolean }).webkitdirectory = true;
        input.multiple = true;
        input.style.display = "none";
        document.body.appendChild(input);
        const hint: string | null = await new Promise((resolve) => {
          let done = false;
          const finish = (v: string | null) => {
            if (done) return;
            done = true;
            input.remove();
            resolve(v);
          };
          input.onchange = () => {
            const files = input.files;
            if (files && files.length > 0) {
              const first = files[0] as File & { webkitRelativePath?: string };
              const rel = first.webkitRelativePath || first.name;
              finish(rel.split("/")[0] || rel.split("\\")[0] || first.name);
            } else finish(null);
          };
          input.addEventListener("cancel", () => finish(null));
          input.click();
          setTimeout(() => finish(null), 60000);
        });
        if (hint && !path().trim()) setPath(hint);
      }
    } catch (err) {
      logger.warn(`folder browse failed: ${(err as Error).message}`);
    }
  }

  return (
    <Dialog open={open()} title={strings.openFolderTitle} onClose={close} width="min(92vw,480px)">
      <div style="display:flex;flex-direction:column;gap:12px">
        <p style="margin:0;font-size:13px;color:var(--muted);line-height:1.5">{strings.folderPathHint}</p>
        <div style="display:flex;gap:8px">
          <input
            value={path()}
            onInput={(e) => setPath(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void onSubmit();
            }}
            placeholder={strings.folderPathPlaceholder}
            autofocus
            class="input"
            style="flex:1;min-width:0"
            aria-label={strings.folderPathLabel}
          />
          <Button variant="ghost" onClick={onBrowse} title={isDesktop() ? strings.folderPickNative : strings.folderEnterPath}>
            <FolderOpen size={14} />
            Browse
          </Button>
        </div>
        <Show when={existingID()}>
          <p style="margin:0;font-size:12.5px;color:var(--warning, #d97706)">{strings.folderSessionExists}</p>
        </Show>
        <div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap">
          <Button variant="ghost" onClick={close}>
            {strings.cancel}
          </Button>
          <Show when={existingID()}>
            <Button variant="ghost" onClick={onSwitchToExisting} disabled={busy()}>
              {strings.folderSwitchExisting}
            </Button>
          </Show>
          <Button variant="primary" onClick={() => void onSubmit(!!existingID())} disabled={!normalized() || busy()}>
            <FolderOpen size={14} />
            {busy() ? strings.loading : existingID() ? strings.folderCreateNew : strings.openFolderTitle}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
