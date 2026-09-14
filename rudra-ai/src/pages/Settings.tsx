import { createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { strings } from "../lib/i18n/en";
import { Dialog } from "../components/ui/Dialog";
import { SettingsBody, SettingsHeader } from "../components/settings/chrome";
import type { SettingsTabId } from "../components/settings/chrome";

export type { SettingsTabId } from "../components/settings/chrome";

/** Modal settings (AppShell). Tab state resets each open; edits apply instantly. */
export function SettingsDialog(props: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = createSignal<SettingsTabId>("general");
  return (
    <Dialog
      open={props.open}
      title={strings.workspaceSettings}
      onClose={() => props.onClose()}
      size="lg"
      hideHeader
    >
      <div style="margin:-4px -4px 0">
        <SettingsHeader onClose={() => props.onClose()} />
      </div>
      <div style="padding-top:16px">
        <SettingsBody tab={tab()} setTab={setTab} />
      </div>
    </Dialog>
  );
}

/** Page route: wide card reusing the same body. */
export function Settings() {
  const navigate = useNavigate();
  const [tab, setTab] = createSignal<SettingsTabId>("general");
  const close = () => navigate("/");
  return (
    <div
      style="flex:1;display:flex;align-items:flex-start;justify-content:center;padding:24px;background:radial-gradient(1200px 600px at 50% -20%, rgba(255,77,28,0.08), transparent 60%), var(--bg);overflow-y:auto"
      class="rudra-scroll"
    >
      <div
        class="rudra-slide-up"
        style="width:min(900px,100%);background:var(--surface);border:1px solid var(--border);border-radius:18px;box-shadow:var(--shadow-lg);overflow:hidden"
      >
        <SettingsHeader onClose={close} />
        <div style="padding:20px">
          <SettingsBody tab={tab()} setTab={setTab} />
        </div>
      </div>
    </div>
  );
}
