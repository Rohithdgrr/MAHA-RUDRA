import { For, Show, createSignal } from "solid-js";
import { adapter } from "../../../lib/backend";
import { strings } from "../../../lib/i18n/en";
import { memoryStore } from "../../../lib/memory/memory.store";
import { githubToCandidates, parseResumeText } from "../../../lib/memory/resumeImport";
import type { ImportDraft } from "../../../lib/memory/resumeImport";
import { uiStore } from "../../../lib/stores/ui.store";
import { Button } from "../../ui/Button";

const inputStyle =
  "box-sizing:border-box;padding:8px 10px;border-radius:9px;border:1px solid var(--border);background:var(--bg);color:var(--fg);font-size:12px;font-family:inherit;outline:none";

const draftId = (d: ImportDraft) => `${d.category}::${d.key}`;

function valueText(v: ImportDraft["value"]): string {
  return typeof v === "string" ? v : JSON.stringify(v);
}

/** Phase 6: bulk import with mandatory preview. Nothing saves until confirmed. */
export function ImportPanel() {
  const [paste, setPaste] = createSignal("");
  const [githubUser, setGithubUser] = createSignal("");
  const [drafts, setDrafts] = createSignal<ImportDraft[]>([]);
  const [selected, setSelected] = createSignal<Record<string, boolean>>({});
  const [busy, setBusy] = createSignal(false);
  const [parsed, setParsed] = createSignal(false);

  const selectAll = (ds: ImportDraft[]) => {
    const s: Record<string, boolean> = {};
    for (const d of ds) s[draftId(d)] = true;
    setSelected(s);
  };

  function onParse() {
    const ds = parseResumeText(paste());
    setDrafts(ds);
    selectAll(ds);
    setParsed(true);
  }

  async function onGitHub() {
    if (!githubUser().trim() || busy()) return;
    setBusy(true);
    try {
      const { profile, repos } = await adapter.importGitHub(githubUser().trim());
      const ds = githubToCandidates(profile, repos);
      setDrafts(ds);
      selectAll(ds);
      setParsed(true);
      if (ds.length === 0) uiStore.toast(strings.memoryImportNone, "info");
    } catch (err) {
      uiStore.toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function edit(id: string, field: "key" | "value", v: string) {
    setDrafts((prev) => prev.map((d) => (draftId(d) === id ? { ...d, [field]: v } : d)));
  }

  async function onSave() {
    const picked = drafts().filter((d) => selected()[draftId(d)]);
    if (picked.length === 0) return;
    let failed = 0;
    const saved = new Set<string>();
    for (const d of picked) {
      if (!d.key.trim() || !String(d.value).trim()) {
        failed++;
        continue;
      }
      try {
        await memoryStore.add({
          category: d.category,
          key: d.key.trim(),
          value: typeof d.value === "string" ? d.value.trim() : d.value,
          confidence: 1,
          source: { sessionId: "import", messageId: "import", excerpt: d.excerpt || "Bulk import" },
        });
        saved.add(draftId(d));
      } catch {
        failed++;
      }
    }
    const ok = saved.size;
    setDrafts((prev) => prev.filter((d) => !saved.has(draftId(d))));
    setSelected({});
    uiStore.toast(
      failed > 0 ? `${strings.memoryImportSaved}: ${ok} (${failed} blocked)` : `${strings.memoryImportSaved}: ${ok}`,
      failed > 0 ? "error" : "success",
    );
  }

  return (
    <section style="margin-bottom:16px;padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--surface)">
      <strong style="font-size:13px">{strings.memoryImport}</strong>
      <p style="margin:6px 0 10px;font-size:11px;color:var(--muted);line-height:1.5">{strings.memoryImportHint}</p>
      <textarea
        value={paste()}
        onInput={(e) => setPaste(e.currentTarget.value)}
        placeholder={strings.memoryPastePlaceholder}
        rows={4}
        style={`${inputStyle};width:100%;resize:vertical;margin-bottom:8px`}
        aria-label={strings.memoryImport}
      />
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <Button variant="ghost" size="sm" onClick={onParse}>{strings.memoryParse}</Button>
        <span style="flex:1" />
        <input
          value={githubUser()}
          onInput={(e) => setGithubUser(e.currentTarget.value)}
          placeholder={strings.memoryGitHubPlaceholder}
          style={`${inputStyle};max-width:170px`}
          aria-label={strings.memoryGitHubPlaceholder}
        />
        <Button variant="ghost" size="sm" onClick={onGitHub}>
          {busy() ? strings.memoryImporting : strings.memoryImportGitHub}
        </Button>
      </div>
      <Show when={parsed() && drafts().length === 0}>
        <p style="font-size:12px;color:var(--muted)">{strings.memoryImportNone}</p>
      </Show>
      <Show when={drafts().length > 0}>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px">
          <For each={drafts()}>
            {(d) => (
              <div style="display:grid;grid-template-columns:auto 110px 1fr;gap:8px;align-items:center;padding:8px;border:1px solid var(--border);border-radius:10px;background:var(--bg)">
                <input
                  type="checkbox"
                  checked={!!selected()[draftId(d)]}
                  onChange={() => toggle(draftId(d))}
                  aria-label={`Select ${d.key}`}
                  style="width:15px;height:15px;accent-color:var(--rudra-orange)"
                />
                <div>
                  <div style="font-size:10px;color:var(--muted)">{d.category}</div>
                  <input
                    value={d.key}
                    onInput={(e) => edit(draftId(d), "key", e.currentTarget.value)}
                    style={`${inputStyle};width:100%;padding:5px 8px;font-size:11px`}
                    aria-label={strings.memoryKey}
                  />
                </div>
                <div>
                  <input
                    value={valueText(d.value)}
                    onInput={(e) => edit(draftId(d), "value", e.currentTarget.value)}
                    style={`${inputStyle};width:100%;padding:5px 8px;font-size:11px`}
                    aria-label={strings.memoryValue}
                  />
                  <Show when={d.excerpt}>
                    <div style="font-size:10px;color:var(--muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">“{d.excerpt}”</div>
                  </Show>
                </div>
              </div>
            )}
          </For>
        </div>
        <Button variant="primary" size="sm" onClick={onSave}>
          {strings.memorySaveSelected} ({drafts().filter((d) => selected()[draftId(d)]).length})
        </Button>
      </Show>
    </section>
  );
}
