import { Eye, ShieldCheck, Zap } from "lucide-solid";
import { strings } from "../../lib/i18n/en";
import { uiStore, type ApprovalMode } from "../../lib/stores/ui.store";
import { Segmented } from "../ui/Segmented";
import { Slider } from "../ui/Slider";
import { Section, ToggleRow } from "./controls";

const APPROVAL_HINTS: Record<ApprovalMode, string> = {
  "always-ask": strings.approvalAlwaysAskHint,
  "read-only": strings.approvalReadOnlyHint,
  autonomous: strings.approvalAutonomousHint,
};

/** Agent behavior. Every control applies immediately — no save step. */
export function AgentTab() {
  const prefs = () => uiStore.state.prefs;
  return (
    <div>
      <Section
        title={strings.toolApprovalMode}
        right={
          <span style="font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted);font-weight:700">
            {strings.gatingStrategy}
          </span>
        }
      >
        <Segmented
          label={strings.toolApprovalMode}
          value={prefs().approvalMode}
          onChange={(v) => uiStore.setPrefs({ approvalMode: v })}
          options={[
            { value: "always-ask", label: strings.approvalAlwaysAsk, icon: () => <ShieldCheck size={13} /> },
            { value: "read-only", label: strings.approvalReadOnly, icon: () => <Eye size={13} /> },
            { value: "autonomous", label: strings.approvalAutonomous, icon: () => <Zap size={13} /> },
          ]}
        />
        <p style="margin:8px 0 0;font-size:11px;color:var(--muted);line-height:1.5">
          {APPROVAL_HINTS[prefs().approvalMode]}
        </p>
      </Section>
      <ToggleRow
        title={strings.confirmBash}
        hint={strings.confirmBashHint}
        checked={prefs().confirmBash}
        onChange={(v) => uiStore.setPrefs({ confirmBash: v })}
      />
      <ToggleRow
        title={strings.confirmWrite}
        hint={strings.confirmWriteHint}
        checked={prefs().confirmWrite}
        onChange={(v) => uiStore.setPrefs({ confirmWrite: v })}
      />
      <ToggleRow
        title={strings.confirmNetwork}
        hint={strings.confirmNetworkHint}
        checked={prefs().confirmNetwork}
        onChange={(v) => uiStore.setPrefs({ confirmNetwork: v })}
      />
      <Section
        title={strings.contextCompression}
        right={
          <span style="font-size:11px;font-weight:800;padding:3px 9px;border-radius:7px;background:rgba(255,77,28,0.1);border:1px solid rgba(255,77,28,0.25);color:var(--rudra-orange);font-family:ui-monospace,monospace">
            {prefs().compressionThreshold}% {strings.threshold}
          </span>
        }
      >
        <Slider
          label={strings.contextCompression}
          min={50}
          max={95}
          value={prefs().compressionThreshold}
          onChange={(v) => uiStore.setPrefs({ compressionThreshold: v })}
        />
        <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:10px;color:var(--muted);font-family:ui-monospace,monospace">
          <span>{strings.compressionConservative}</span>
          <span>{strings.compressionOptimized}</span>
          <span>{strings.compressionAggressive}</span>
        </div>
      </Section>
    </div>
  );
}
