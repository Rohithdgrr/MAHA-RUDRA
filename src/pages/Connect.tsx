import { useNavigate } from "@solidjs/router";
import { createSignal, onMount, Show } from "solid-js";
import { adapter } from "../lib/backend";
import { strings } from "../lib/i18n/en";
import { isVersionAtLeast, validateServerUrl } from "../lib/opencode/server";
import { uiStore } from "../lib/stores/ui.store";
import { getServerUrl, isTauri, setServerUrl } from "../lib/utils/env";
import { logger } from "../lib/utils/logger";
import { Button } from "../components/ui/Button";
import { Logo } from "../components/ui/Logo";

type ProbeState = "idle" | "checking" | "protected" | "open" | "unreachable";

/** Server connection screen. Skipped automatically in Tauri sidecar mode. */
export function Connect() {
  const navigate = useNavigate();
  const [url, setUrl] = createSignal(getServerUrl());
  const [username, setUsername] = createSignal("opencode");
  const [password, setPassword] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | undefined>(undefined);
  const [probe, setProbe] = createSignal<ProbeState>("idle");
  const [oldServer, setOldServer] = createSignal(false);

  const hasPadding = () => password() !== password().trim() && password().length > 0;
  const urlCheck = () => validateServerUrl(url());
  const urlValid = () => urlCheck().ok;
  const remoteNoAuth = () => {
    const check = urlCheck();
    return check.ok && check.remote && !password();
  };

  async function probeUrl(target: string): Promise<void> {
    const check = validateServerUrl(target);
    if (!check.ok) {
      setProbe("idle");
      return;
    }
    setProbe("checking");
    try {
      setProbe((await adapter.requiresAuth(check.url)) ? "protected" : "open");
    } catch {
      setProbe("unreachable");
    }
  }

  async function doConnect(target: string, user: string, pass: string) {
    setBusy(true);
    setError(undefined);
    setOldServer(false);
    try {
      const check = validateServerUrl(target);
      if (!check.ok) throw new Error(strings.serverUrlInvalid);
      if (probe() === "protected" && !pass) {
        throw new Error(strings.authRequired);
      }
      await adapter.connect({ baseUrl: check.url, username: user || undefined, password: pass || undefined });
      setServerUrl(check.url);
      const health = await adapter.health();
      if (!isVersionAtLeast(health.version)) setOldServer(true);
      uiStore.setConnection("connected", health.version);
      uiStore.toast(`Connected to OpenCode v${health.version}`, "success");
      navigate("/", { replace: true });
    } catch (err) {
      logger.error(err);
      const msg = (err as Error).message;
      setError(msg);
      uiStore.setConnection("disconnected");
    } finally {
      setBusy(false);
    }
  }

  onMount(() => {
    if (isTauri()) {
      void doConnect("http://localhost:4096", "opencode", "");
      return;
    }
    // Auto-connect: open servers skip the form entirely.
    void (async () => {
      await probeUrl(url());
      if (probe() === "open") await doConnect(url(), "", "");
    })();
  });

  return (
    <div style="min-height:100%;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--bg)">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void doConnect(url(), username(), password());
        }}
        style="width:min(94vw,440px);background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:28px;display:flex;flex-direction:column;gap:14px"
      >
        <Logo />
        <h1 style="margin:0;font-size:20px">{strings.connectTitle}</h1>
        <p style="margin:0;color:var(--muted);font-size:13px">
          Start the server first: <code>opencode serve --port 4096 --cors http://localhost:5173</code>
        </p>
        <Show when={probe() === "protected"}>
          <p style="margin:0;font-size:13px;color:var(--rudra-orange)">{strings.serverRequiresAuth}</p>
        </Show>
        <Show when={probe() === "open"}>
          <p style="margin:0;font-size:13px;color:var(--success)">{strings.serverOpen}</p>
        </Show>
        <Show when={probe() === "unreachable"}>
          <p style="margin:0;font-size:13px;color:var(--danger)">{strings.serverUnreachable}</p>
        </Show>
        <Show when={!urlValid() && url().trim()}>
          <p style="margin:0;font-size:13px;color:var(--danger)">{strings.serverUrlInvalid}</p>
        </Show>
        <Show when={remoteNoAuth()}>
          <p style="margin:0;font-size:13px;color:var(--rudra-orange)">{strings.serverRemoteNoAuth}</p>
        </Show>
        <Show when={oldServer()}>
          <p style="margin:0;font-size:13px;color:var(--rudra-orange)">{strings.serverVersionOld}</p>
        </Show>
        <label style="display:flex;flex-direction:column;gap:6px;font-size:13px">
          {strings.serverUrl}
          <input
            value={url()}
            onInput={(e) => setUrl(e.currentTarget.value)}
            onBlur={() => void probeUrl(url())}
            placeholder={strings.serverUrlPlaceholder}
            inputmode="url"
            style="background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:14px"
          />
        </label>
        <label style="display:flex;flex-direction:column;gap:6px;font-size:13px">
          {strings.username}
          <input
            value={username()}
            onInput={(e) => setUsername(e.currentTarget.value)}
            autocomplete="username"
            style="background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:14px"
          />
        </label>
        <label style="display:flex;flex-direction:column;gap:6px;font-size:13px">
          {strings.password}
          <input
            type="password"
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
            placeholder={strings.passwordPlaceholder}
            autocomplete="current-password"
            style="background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:14px"
          />
        </label>
        <Show when={hasPadding()}>
          <p style="margin:0;font-size:12px;color:var(--danger)">{strings.passwordPadding}</p>
        </Show>
        <Show when={error()}>
          <p style="color:var(--danger);font-size:13px;margin:0">{error()}</p>
        </Show>
        <Button type="submit" variant="primary" disabled={busy() || !urlValid()}>
          {busy() ? strings.loading : strings.connect}
        </Button>
      </form>
    </div>
  );
}
