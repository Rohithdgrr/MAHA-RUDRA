import { createSignal } from "solid-js";

const DEV_KEY = "rudra.devMode";

function readStored(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(DEV_KEY) === "1";
  } catch {
    return false;
  }
}

const [mode, setMode] = createSignal(readStored());

/** Persisted developer-mode flag (verbose logging + raw event viewer). */
export function devMode(): boolean {
  return mode();
}

export function setDevMode(on: boolean): void {
  setMode(on);
  try {
    if (typeof window !== "undefined") {
      if (on) window.localStorage.setItem(DEV_KEY, "1");
      else window.localStorage.removeItem(DEV_KEY);
    }
  } catch {
    // storage unavailable — non-fatal
  }
}
