import { strings } from "../../../lib/i18n/en";
import { uiStore } from "../../../lib/stores/ui.store";
import { Slider } from "../../ui/Slider";
import { Toggle } from "../../ui/Toggle";

/** Phase 5: injection controls. Binds uiStore directly (applies immediately). */
export function InjectionPanel() {
  const prefs = () => uiStore.state.prefs;
  return (
    <section style="margin-bottom:16px;padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--surface)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700">{strings.memoryInjection}</div>
          <div style="margin-top:2px;font-size:11px;color:var(--muted)">{strings.memoryIncludeHint}</div>
        </div>
        <Toggle
          checked={prefs().memoryEnabled}
          onChange={(v) => uiStore.setPrefs({ memoryEnabled: v })}
          label={strings.memoryIncludeInPrompts}
        />
      </div>
      <div style="display:flex;align-items:center;gap:12px;margin-top:12px">
        <span style="font-size:11px;color:var(--muted);white-space:nowrap">
          {strings.memoryBudget}: {prefs().memoryBudgetTokens}
        </span>
        <Slider
          label={strings.memoryBudget}
          min={200}
          max={2048}
          step={50}
          value={prefs().memoryBudgetTokens}
          onChange={(v) => uiStore.setPrefs({ memoryBudgetTokens: v })}
        />
      </div>
      <p style="margin:6px 0 0;font-size:11px;color:var(--muted)">{strings.memoryBudgetHint}</p>
      <div style="display:flex;align-items:center;gap:12px;margin-top:12px">
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:700">🔒 {strings.memorySensitiveOptIn}</div>
          <div style="margin-top:2px;font-size:11px;color:var(--muted)">{strings.memorySensitiveHint}</div>
        </div>
        <Toggle
          checked={prefs().includeSensitiveMemory}
          onChange={(v) => uiStore.setPrefs({ includeSensitiveMemory: v })}
          label={strings.memorySensitiveOptIn}
        />
      </div>
      <div style="display:flex;align-items:center;gap:12px;margin-top:12px">
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:700">{strings.memoryAutoSave}</div>
          <div style="margin-top:2px;font-size:11px;color:var(--muted)">{strings.memoryAutoSaveHint}</div>
        </div>
        <Toggle
          checked={prefs().memoryAutoSave}
          onChange={(v) => uiStore.setPrefs({ memoryAutoSave: v })}
          label={strings.memoryAutoSave}
        />
      </div>
    </section>
  );
}
