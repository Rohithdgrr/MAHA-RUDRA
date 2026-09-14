import { isTauri } from "../utils/env";
import { httpAdapter } from "./http-adapter";
import { tauriAdapter } from "./tauri-adapter";
import type { BackendAdapter } from "./types";

export type { BackendAdapter };
export * from "./types";

/** Auto-selects the adapter: Tauri sidecar mode vs. web HTTP mode. */
export function getAdapter(): BackendAdapter {
  return isTauri() ? tauriAdapter : httpAdapter;
}

export const adapter: BackendAdapter = getAdapter();
