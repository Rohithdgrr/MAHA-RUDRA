import { createStore } from "solid-js/store";

export type Theme = "dark" | "light";
export type ConnectionStatus = "unknown" | "connected" | "disconnected";

export const THEME_KEY = "rudra.theme";

function initialTheme(): Theme {
  try {
    if (typeof window !== "undefined" && window.localStorage.getItem(THEME_KEY) === "light") {
      return "light";
    }
  } catch {
    // storage unavailable — fall through to the document class
  }
  if (typeof document !== "undefined" && !document.documentElement.classList.contains("dark")) {
    return "light";
  }
  return "dark";
}

interface UiState {
  theme: Theme;
  connection: ConnectionStatus;
  serverVersion: string | undefined;
  toast: string | undefined;
  toastKind: "success" | "error" | "info";
  paletteOpen: boolean;
  settingsOpen: boolean;
}

const [state, setState] = createStore<UiState>({
  theme: initialTheme(),
  connection: "unknown",
  serverVersion: undefined,
  toast: undefined,
  toastKind: "info",
  paletteOpen: false,
  settingsOpen: false,
});

export const uiStore = {
  get state() {
    return state;
  },
  setTheme(theme: Theme) {
    setState("theme", theme);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  },
  setConnection(connection: ConnectionStatus, version?: string) {
    setState("connection", connection);
    if (version !== undefined) setState("serverVersion", version);
  },
  toast(message: string | undefined, kind: UiState["toastKind"] = "info") {
    setState("toast", message);
    setState("toastKind", kind);
  },
  setPalette(open: boolean) {
    setState("paletteOpen", open);
  },
  setSettingsOpen(open: boolean) {
    setState("settingsOpen", open);
  },
};
