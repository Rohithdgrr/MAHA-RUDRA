import { adapter } from "../backend";
import type { ModelSelection, Provider, ProviderList } from "../backend/types";

const MODEL_KEY = "rudra.model";

export interface ModelOption {
  providerID: string;
  providerName: string;
  modelID: string;
  modelName: string;
  /** "providerID/modelID" — the <select> value. */
  value: string;
  label: string;
}

/** Flatten `Provider[].models` maps into a sorted option list. Pure, tested. */
export function toModelOptions(providers: Provider[]): ModelOption[] {
  const options: ModelOption[] = [];
  for (const p of providers ?? []) {
    const models = p.models ?? {};
    for (const [modelID, m] of Object.entries(models)) {
      const modelName = (m as { name?: string }).name || modelID;
      options.push({
        providerID: p.id,
        providerName: p.name || p.id,
        modelID,
        modelName,
        value: `${p.id}/${modelID}`,
        label: `${p.name || p.id} · ${modelName}`,
      });
    }
  }
  options.sort((a, b) => a.label.localeCompare(b.label));
  return options;
}

function parseStored(value: string | null): ModelSelection | undefined {
  if (!value) return undefined;
  const slash = value.indexOf("/");
  if (slash <= 0 || slash === value.length - 1) return undefined;
  return { providerID: value.slice(0, slash), modelID: value.slice(slash + 1) };
}

/** Last-picked model, persisted in localStorage. Undefined = server default. */
export function getModelSelection(): ModelSelection | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return parseStored(window.localStorage.getItem(MODEL_KEY));
  } catch {
    return undefined;
  }
}

export function setModelSelection(sel: ModelSelection | undefined): void {
  if (typeof window === "undefined") return;
  try {
    if (!sel) window.localStorage.removeItem(MODEL_KEY);
    else window.localStorage.setItem(MODEL_KEY, `${sel.providerID}/${sel.modelID}`);
  } catch {
    // storage unavailable — non-fatal
  }
}

export function formatSelection(sel: ModelSelection | undefined): string {
  return sel ? `${sel.providerID}/${sel.modelID}` : "";
}

export async function listProviders(): Promise<ProviderList> {
  return adapter.listProviders();
}
