import { adapter } from "../backend";
import type { CreateSessionInput, Session } from "../backend/types";

export async function listSessions(): Promise<Session[]> {
  return adapter.listSessions();
}

export async function createSession(input: CreateSessionInput = {}): Promise<Session> {
  return adapter.createSession(input);
}

export async function getSession(id: string): Promise<Session> {
  return adapter.getSession(id);
}

export async function deleteSession(id: string): Promise<void> {
  return adapter.deleteSession(id);
}

export async function abortSession(id: string): Promise<void> {
  return adapter.abortSession(id);
}
