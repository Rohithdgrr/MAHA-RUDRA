import { createSignal, onCleanup } from "solid-js";
import { strings } from "../../../lib/i18n/en";
import { memoryToJson, memoryToMarkdown } from "../../../lib/memory/export";
import { memoryStore } from "../../../lib/memory/memory.store";
import { downloadText } from "../../../lib/utils/export";
import { uiStore } from "../../../lib/stores/ui.store";
import { Button } from "../../ui/Button";

function stamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

/** Phase 7: portable export + total wipe. Delete also clears the audit log. */
export function DataPanel() {
  const [armed, setArmed] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    if (timer) clearTimeout(timer);
  });

  const all = () => memoryStore.state.memories;
  const counts = () =>
    `${all().filter((m) => m.status === "active").length} active · ${all().filter((m) => m.status === "pending").length} pending`;

  function onExportJson() {
    downloadText(`rudra-memory-${stamp()}.json`, memoryToJson(all()), "application/json");
    uiStore.toast(strings.memoryExported, "success");
  }

  function onExportMarkdown() {
    downloadText(`rudra-memory-${stamp()}.md`, memoryToMarkdown(all()), "text/markdown");
    uiStore.toast(strings.memoryExported, "success");
  }

  async function onDelete() {
    if (!armed()) {
      setArmed(true);
      timer = setTimeout(() => setArmed(false), 5000);
      return;
    }
    if (timer) clearTimeout(timer);
    setArmed(false);
    await memoryStore.clearAll();
    uiStore.toast(strings.memoryDeletedAll, "info");
  }

  return (
    <section style="margin-bottom:16px;padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--surface)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <strong style="font-size:13px">{strings.memoryData}</strong>
        <span style="font-size:11px;color:var(--muted)">{counts()}</span>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <Button variant="ghost" size="sm" onClick={onExportJson}>{strings.memoryExportJson}</Button>
        <Button variant="ghost" size="sm" onClick={onExportMarkdown}>{strings.memoryExportMarkdown}</Button>
        <span style="flex:1" />
        <Button variant="ghost" size="sm" onClick={onDelete}>
          {armed() ? strings.memoryConfirmDelete : strings.memoryDeleteAll}
        </Button>
      </div>
    </section>
  );
}
