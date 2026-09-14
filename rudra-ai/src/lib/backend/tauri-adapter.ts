import { HttpBackendAdapter } from "./http-adapter";
import type {
  Agent,
  BackendAdapter,
  ConnectConfig,
  CreateSessionInput,
  MessageWithParts,
  ProviderList,
  RudraEventHandler,
  SendPromptInput,
  ServerHealth,
  Session,
  StreamStateHandler,
  Unsubscribe,
} from "./types";

/**
 * Desktop adapter (Phase 4). The Rust sidecar runs the same
 * `opencode serve` on 127.0.0.1:4096, so the transport is identical to
 * web — only the server *lifecycle* differs (owned by Rust, not the user).
 * Delegating to `HttpBackendAdapter` is the whole point of the seam:
 * the Tauri migration was a swap, not a rewrite.
 */
export class TauriBackendAdapter implements BackendAdapter {
  private readonly inner = new HttpBackendAdapter();

  connect(config: ConnectConfig): Promise<void> {
    return this.inner.connect(config);
  }
  disconnect(): void {
    this.inner.disconnect();
  }
  isConnected(): boolean {
    return this.inner.isConnected();
  }
  listSessions(): Promise<Session[]> {
    return this.inner.listSessions();
  }
  createSession(input: CreateSessionInput): Promise<Session> {
    return this.inner.createSession(input);
  }
  getSession(id: string): Promise<Session> {
    return this.inner.getSession(id);
  }
  deleteSession(id: string): Promise<void> {
    return this.inner.deleteSession(id);
  }
  getMessages(sessionID: string): Promise<MessageWithParts[]> {
    return this.inner.getMessages(sessionID);
  }
  getTodos(sessionID: string): Promise<import("@opencode-ai/sdk/client").Todo[]> {
    return this.inner.getTodos(sessionID);
  }
  replyPermission(
    sessionID: string,
    permissionID: string,
    response: "once" | "always" | "reject",
  ): Promise<void> {
    return this.inner.replyPermission(sessionID, permissionID, response);
  }
  sendPrompt(input: SendPromptInput): Promise<void> {
    return this.inner.sendPrompt(input);
  }
  abortSession(sessionID: string): Promise<void> {
    return this.inner.abortSession(sessionID);
  }
  listProviders(): Promise<ProviderList> {
    return this.inner.listProviders();
  }
  listAgents(): Promise<Agent[]> {
    return this.inner.listAgents();
  }
  importGitHub(username: string): Promise<{ profile: unknown; repos: unknown }> {
    return this.inner.importGitHub(username);
  }
  subscribeToEvents(handler: RudraEventHandler): Unsubscribe {
    return this.inner.subscribeToEvents(handler);
  }
  subscribeToStreamState(handler: StreamStateHandler): Unsubscribe {
    return this.inner.subscribeToStreamState(handler);
  }
  health(): Promise<ServerHealth> {
    return this.inner.health();
  }
  requiresAuth(baseUrl: string): Promise<boolean> {
    return this.inner.requiresAuth(baseUrl);
  }
}

export const tauriAdapter = new TauriBackendAdapter();
