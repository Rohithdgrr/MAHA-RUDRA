import { createStore } from "solid-js/store";
import type { Permission } from "@opencode-ai/sdk/client";

interface PermissionState {
  bySession: Record<string, Permission[]>;
}

const [state, setState] = createStore<PermissionState>({
  bySession: {},
});

export const permissionStore = {
  get state() {
    return state;
  },
  pendingFor(sessionID: string | undefined): Permission[] {
    if (!sessionID) return [];
    return state.bySession[sessionID] ?? [];
  },
  upsert(permission: Permission) {
    const sid = permission.sessionID;
    const list = state.bySession[sid] ?? [];
    const idx = list.findIndex((p) => p.id === permission.id);
    if (idx === -1) {
      setState("bySession", sid, [...list, permission]);
    } else {
      setState("bySession", sid, idx, permission);
    }
  },
  remove(sessionID: string, permissionID: string) {
    const list = state.bySession[sessionID] ?? [];
    setState(
      "bySession",
      sessionID,
      list.filter((p) => p.id !== permissionID),
    );
  },
  clear(sessionID: string) {
    setState("bySession", sessionID, []);
  },
};
