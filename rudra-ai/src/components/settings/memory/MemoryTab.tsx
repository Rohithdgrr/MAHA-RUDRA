import { For, Show, createSignal, onMount } from "solid-js";
import { strings } from "../../../lib/i18n/en";
import { MEMORY_CATEGORIES, CATEGORY_LABELS, formatMemoryValue } from "../../../lib/memory/types";
import type { MemoryCategory } from "../../../lib/memory/types";
import { memoryStore } from "../../../lib/memory/memory.store";
import { uiStore } from "../../../lib/stores/ui.store";
import { Button } from "../../ui/Button";
import { AuditLog } from "./AuditLog";
import { DataPanel } from "./DataPanel";
import { InjectionPanel } from "./InjectionPanel";
import { ImportPanel } from "./ImportPanel";
import { ReviewQueue } from "./ReviewQueue";

const inputStyle =
  "box-sizing:border-box;padding:8px 10px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--fg);font-size:12px;font-family:inherit;outline:none";

/** Memory settings: injection controls, review queue, manual CRUD, import, data, audit. */
export function MemoryTab() {
  const [category, setCategory] = createSignal<MemoryCategory>("identity");
  const [key, setKey] = createSignal("");
  const [value, setValue] = createSignal("");
  const [editingId, setEditingId] = createSignal<string | undefined>(undefined);
  const [editValue, setEditValue] = createSignal("");

  onMount(() => void memoryStore.load());

  const active = () => memoryStore.state.memories.filter((m) => m.status === "active");
  const archived = () => memoryStore.state.memories.filter((m) => m.status === "archived");

  async function onAdd() {
    if (!key().trim() || !value().trim()) return;
    try {
      await memoryStore.add({ category: category(), key: key().trim(), value: value().trim() });
      setKey("");
      setValue("");
      uiStore.toast(strings.memorySaved, "success");
    } catch (err) {
      uiStore.toast((err as Error).message, "error");
    }
  }

  async function onSaveEdit(id: string) {
    try {
      await memoryStore.update(id, { value: editValue() });
      setEditingId(undefined);
      uiStore.toast(strings.memorySaved, "success");
    } catch (err) {
      uiStore.toast((err as Error).message, "error");
    }
  }

  return (
    <div>
      <p style="margin:0 0 12px;font-size:11px;color:var(--muted);line-height:1.5">
        {strings.memorySubtitle}
      </p>
      <InjectionPanel />
      <ReviewQueue />
      <div style="display:grid;grid-template-columns:130px 1fr;gap:8px;margin-bottom:8px">
        <select value={category()} onChange={(e) => setCategory(e.currentTarget.value as MemoryCategory)} style={inputStyle} aria-label={strings.memoryCategory}>
          <For each={MEMORY_CATEGORIES}>{(c) => <option value={c}>{CATEGORY_LABELS[c]}</option>}</For>
        </select>
        <input value={key()} onInput={(e) => setKey(e.currentTarget.value)} placeholder={strings.memoryKeyPlaceholder} style={inputStyle} aria-label={strings.memoryKey} />
      </div>
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <input value={value()} onInput={(e) => setValue(e.currentTarget.value)} placeholder={strings.memoryValuePlaceholder} style={`flex:1;${inputStyle}`} aria-label={strings.memoryValue} />
        <Button variant="primary" size="sm" onClick={onAdd}>{strings.memoryAdd}</Button>
      </div>
      <Show when={active().length === 0}>
        <p style="font-size:12px;color:var(--muted)">{strings.memoryEmpty}</p>
      </Show>
      <div style="display:flex;flex-direction:column;gap:8px">
        <For each={active()}>
          {(m) => (
            <div style="padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface)">
              <div style="display:flex;align-items:center;gap:8px;font-size:12px">
                <strong>{CATEGORY_LABELS[m.category]} · {m.key}</strong>
                <span style="margin-left:auto" />
                <Show when={editingId() !== m.id}>
                  <button type="button" onClick={() => { setEditingId(m.id); setEditValue(formatMemoryValue(m.value)); }} style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:11px">Edit</button>
                  <button type="button" onClick={() => void memoryStore.setStatus(m.id, "archived")} style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:11px">{strings.memoryArchive}</button>
                  <button type="button" onClick={() => void memoryStore.remove(m.id)} style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:11px">{strings.memoryDelete}</button>
                </Show>
              </div>
              <Show when={editingId() === m.id} fallback={<div style="margin-top:4px;font-size:12px">{formatMemoryValue(m.value)}</div>}>
                <div style="display:flex;gap:8px;margin-top:6px">
                  <input value={editValue()} onInput={(e) => setEditValue(e.currentTarget.value)} style={`flex:1;${inputStyle}`} aria-label={strings.memoryValue} />
                  <Button variant="primary" size="sm" onClick={() => void onSaveEdit(m.id)}>{strings.memorySave}</Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(undefined)}>Cancel</Button>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>
      <Show when={archived().length > 0}>
        <h4 style="margin:16px 0 8px;font-size:12px;color:var(--muted)">Forgotten ({archived().length})</h4>
        <For each={archived()}>
          {(m) => (
            <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted);padding:6px 0">
              <span>{m.category} · {m.key}</span>
              <span style="margin-left:auto" />
              <button type="button" onClick={() => void memoryStore.setStatus(m.id, "active")} style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:11px">{strings.memoryRestore}</button>
              <button type="button" onClick={() => void memoryStore.remove(m.id)} style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:11px">{strings.memoryDelete}</button>
            </div>
          )}
        </For>
      </Show>
      <div style="margin-top:16px">
        <ImportPanel />
      </div>
      <DataPanel />
      <AuditLog />
    </div>
  );
}
