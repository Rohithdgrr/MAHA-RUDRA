import { createStore } from "solid-js/store";
import type { Session, SessionStatus } from "../backend/types";

interface SessionState {
  sessions: Session[];
  activeID: string | undefined;
  loading: boolean;
  error: string | undefined;
  statusBySession: Record<string, SessionStatus>;
}

const [state, setState] = createStore<SessionState>({
  sessions: [],
  activeID: undefined,
  loading: false,
  error: undefined,
  statusBySession: {},
});

export const sessionStore = {
  get state() {
    return state;
  },
  setSessions(sessions: Session[]) {
    setState("sessions", sessions);
  },
  addSession(session: Session) {
    setState("sessions", (prev) => [session, ...prev]);
    setState("activeID", session.id);
  },
  removeSession(id: string) {
    setState("sessions", (prev) => prev.filter((s) => s.id !== id));
    if (state.activeID === id) setState("activeID", undefined);
  },
  setActive(id: string | undefined) {
    setState("activeID", id);
  },
  setLoading(loading: boolean) {
    setState("loading", loading);
  },
  setError(error: string | undefined) {
    setState("error", error);
  },
  /** Live-apply `session.created` / `session.updated` from SSE. */
  upsertSession(session: Session) {
    const idx = state.sessions.findIndex((s) => s.id === session.id);
    if (idx === -1) {
      setState("sessions", (prev) => [session, ...prev]);
    } else {
      setState("sessions", idx, session);
    }
  },
  setStatus(sessionID: string, status: SessionStatus) {
    setState("statusBySession", sessionID, status);
  },
  markIdle(sessionID: string) {
    setState("statusBySession", sessionID, { type: "idle" });
  },
  statusFor(sessionID: string | undefined): SessionStatus | undefined {
    if (!sessionID) return undefined;
    return state.statusBySession[sessionID];
  },
  isBusy(sessionID: string | undefined): boolean {
    const s = sessionID ? state.statusBySession[sessionID] : undefined;
    return s !== undefined && s.type !== "idle";
  },
};
