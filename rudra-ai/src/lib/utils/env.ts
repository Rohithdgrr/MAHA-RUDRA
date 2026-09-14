const SERVER_URL_KEY = "rudra.serverUrl";
const DEFAULT_SERVER_URL = "http://localhost:4096";

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

/** True when running inside a Tauri webview (Phase 4 sidecar mode).
 *
 * Tauri v2 no longer guarantees `window.__TAURI__` (it only exists when
 * `app.withGlobalTauri` is enabled, which this app does not set). The
 * runtime always injects `window.__TAURI_INTERNALS__`, and
 * `@tauri-apps/api` v2's `isTauri()` checks `globalThis.isTauri`.
 * Check all of them so the native folder dialog actually opens on desktop.
 */
export function isTauri(): boolean {
  if (!hasWindow()) return false;
  try {
    const w = window as unknown as Record<string, unknown>;
    const g = globalThis as unknown as Record<string, unknown>;
    return (
      "__TAURI_INTERNALS__" in window ||
      "__TAURI__" in window ||
      w["isTauri"] === true ||
      g["isTauri"] === true
    );
  } catch {
    return false;
  }
}

/** Last-used server URL, persisted in localStorage. */
export function getServerUrl(): string {
  if (!hasWindow()) return DEFAULT_SERVER_URL;
  try {
    return window.localStorage.getItem(SERVER_URL_KEY) ?? DEFAULT_SERVER_URL;
  } catch {
    return DEFAULT_SERVER_URL;
  }
}

export function setServerUrl(url: string): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(SERVER_URL_KEY, url);
  } catch {
    // storage unavailable (private mode) — non-fatal
  }
}

export function buildBasicAuthHeader(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

export const envDefaults = {
  serverUrlKey: SERVER_URL_KEY,
  defaultServerUrl: DEFAULT_SERVER_URL,
} as const;
