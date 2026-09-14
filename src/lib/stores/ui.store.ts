import { createStore } from "solid-js/store";

export type Theme = "dark" | "light";
export type ConnectionStatus = "unknown" | "connected" | "disconnected";

export const THEME_KEY = "rudra.theme";
const PREFS_KEY = "rudra.prefs";

/** Workspace prefs (Phase A foundation; settings modal + composer bind to these). */
export type ApprovalMode = "always-ask" | "read-only" | "autonomous";
export type EffortLevel = "Low" | "Medium" | "High";

export interface Prefs {
  approvalMode: ApprovalMode;
  compressionThreshold: number;
  daemonAutoConnect: boolean;
  telemetryAlertAt: string;
  effort: EffortLevel;
}

export const DEFAULT_PREFS: Prefs = {
  approvalMode: "always-ask",
  compressionThreshold: 85,
  daemonAutoConnect: true,
  telemetryAlertAt: "10.00",
  effort: "Low",
};

const APPROVAL_MODES: ApprovalMode[] = ["always-ask", "read-only", "autonomous"];
const EFFORT_LEVELS: EffortLevel[] = ["Low", "Medium", "High"];

/** Load persisted prefs, validating each field; unknown/corrupt values fall back. Pure. */
export function loadPrefs(raw: string | null | undefined): Prefs {
  if (!raw) return { ...DEFAULT_PREFS };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_PREFS };
  }
  if (typeof parsed !== "object" || parsed === null) return { ...DEFAULT_PREFS };
  const p = parsed as Partial<Record<keyof Prefs, unknown>>;
  return {
    approvalMode: APPROVAL_MODES.includes(p.approvalMode as ApprovalMode)
      ? (p.approvalMode as ApprovalMode)
      : DEFAULT_PREFS.approvalMode,
    compressionThreshold:
      typeof p.compressionThreshold === "number" &&
      Number.isFinite(p.compressionThreshold)
        ? Math.min(95, Math.max(50, Math.round(p.compressionThreshold)))
        : DEFAULT_PREFS.compressionThreshold,
    daemonAutoConnect:
      typeof p.daemonAutoConnect === "boolean"
        ? p.daemonAutoConnect
        : DEFAULT_PREFS.daemonAutoConnect,
    telemetryAlertAt:
      typeof p.telemetryAlertAt === "string" && p.telemetryAlertAt.trim()
        ? p.telemetryAlertAt
        : DEFAULT_PREFS.telemetryAlertAt,
    effort: EFFORT_LEVELS.includes(p.effort as EffortLevel)
      ? (p.effort as EffortLevel)
      : DEFAULT_PREFS.effort,
  };
}

function readStoredPrefs(): Prefs {
  if (typeof window === "undefined") return { ...DEFAULT_PREFS };
  try {
    return loadPrefs(window.localStorage.getItem(PREFS_KEY));
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

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
  prefs: Prefs;
}

const [state, setState] = createStore<UiState>({
  theme: initialTheme(),
  connection: "unknown",
  serverVersion: undefined,
  toast: undefined,
  toastKind: "info",
  paletteOpen: false,
  settingsOpen: false,
  prefs: readStoredPrefs(),
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
  /** Merge a prefs patch and persist the whole object. */
  setPrefs(patch: Partial<Prefs>) {
    setState("prefs", (prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable — non-fatal
      }
      return next;
    });
  },
  resetPrefs() {
    setState("prefs", { ...DEFAULT_PREFS });
    try {
      window.localStorage.removeItem(PREFS_KEY);
    } catch {
      // ignore
    }
  },
};
