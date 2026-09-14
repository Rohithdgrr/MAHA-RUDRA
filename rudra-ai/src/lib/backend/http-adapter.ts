import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk/client";
import type { Event as ServerEvent } from "@opencode-ai/sdk/client";
import { strings } from "../i18n/en";
import { buildBasicAuthHeader } from "../utils/env";
import { logger } from "../utils/logger";
import { devMode } from "../utils/devmode";
import { logRawEvent } from "./eventLog";
import type {
  BackendAdapter,
  ConnectConfig,
  CreateSessionInput,
  MessageWithParts,
  RudraEvent,
  RudraEventHandler,
  SendPromptInput,
  ServerHealth,
  StreamState,
  StreamStateHandler,
  Unsubscribe,
} from "./types";
import { RudraError, toRudraEvent } from "./types";
import { nextReconnectDelay } from "./reconnect";

interface FieldResult<TData, TError> {
  data: TData | undefined;
  error: TError | undefined;
}

function unwrap<TData, TError>(result: FieldResult<TData, TError>, what: string): TData {
  if (result.error !== undefined) {
    throw new RudraError("server_error", `${what} failed: ${JSON.stringify(result.error)}`);
  }
  if (result.data === undefined) {
    throw new RudraError("server_error", `${what} returned no data`);
  }
  return result.data;
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/**
 * Feed one raw SSE `data:` payload into `onEvent`. Exported for tests.
 * Accepts both `GlobalEvent` (`{ payload: Event }`) and bare `Event` shapes.
 */
export function handleSseData(raw: string, onEvent: (e: ServerEvent) => void): void {
  const trimmed = raw.trim();
  if (!trimmed) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    logger.warn("Ignoring non-JSON SSE data");
    return;
  }
  const candidate =
    parsed !== null && typeof parsed === "object" && "payload" in (parsed as Record<string, unknown>)
      ? (parsed as { payload: unknown }).payload
      : parsed;
  if (candidate !== null && typeof candidate === "object" && "type" in (candidate as Record<string, unknown>)) {
    onEvent(candidate as ServerEvent);
  }
}

/** Split a text buffer into complete SSE events; returns leftover tail. */
export function splitSseBuffer(buffer: string, onData: (data: string) => void): string {
  const parts = buffer.split(/\r?\n\r?\n/);
  const tail = parts.pop() ?? "";
  for (const chunk of parts) {
    const lines = chunk.split(/\r?\n/);
    const dataLines = lines
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice("data:".length).trimStart());
    if (dataLines.length > 0) onData(dataLines.join("\n"));
  }
  return tail;
}

/**
 * Web implementation: talks to `opencode serve` over HTTP.
 * The ONLY file allowed to touch fetch or the OpenCode SDK.
 */
export class HttpBackendAdapter implements BackendAdapter {
  private client: OpencodeClient | undefined;
  private baseUrl = "";
  private authHeader: string | undefined;
  private handlers = new Set<RudraEventHandler>();
  private streamListeners = new Set<StreamStateHandler>();
  private sseAbort: AbortController | undefined;
  private sseRunning = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private reconnectAttempt = 0;

  async connect(config: ConnectConfig): Promise<void> {
    const baseUrl = normalizeBaseUrl(config.baseUrl);
    if (!baseUrl) throw new RudraError("invalid_config", "Server URL is required");

    const username = config.username?.trim() || "opencode";
    this.authHeader = config.password ? buildBasicAuthHeader(username, config.password) : undefined;

    this.client = createOpencodeClient({
      baseUrl,
      fetch: (req: Request) => {
        if (this.authHeader) req.headers.set("Authorization", this.authHeader);
        return globalThis.fetch(req);
      },
    });
    this.baseUrl = baseUrl;

    const health = await this.health();
    if (!health.healthy) throw new RudraError("unhealthy", "Server reported unhealthy");
    logger.info(`Connected to OpenCode server at ${baseUrl} (v${health.version})`);
    // Re-point any live SSE subscription at the new URL.
    this.stopStream();
    if (this.handlers.size > 0) void this.ensureStream();
  }

  disconnect(): void {
    this.client = undefined;
    this.baseUrl = "";
    this.authHeader = undefined;
    this.stopStream();
    this.handlers.clear();
  }

  isConnected(): boolean {
    return this.client !== undefined;
  }

  private requireClient(): OpencodeClient {
    if (!this.client) throw new RudraError("not_connected", "Not connected to a server");
    return this.client;
  }

  private authedInit(): RequestInit {
    return this.authHeader ? { headers: { Authorization: this.authHeader } } : {};
  }

  async health(): Promise<ServerHealth> {
    if (!this.baseUrl) throw new RudraError("not_connected", "Not connected to a server");
    let res: Response;
    try {
      res = await globalThis.fetch(`${this.baseUrl}/global/health`, this.authedInit());
    } catch (err) {
      throw new RudraError("unreachable", `Cannot reach server: ${(err as Error).message}`);
    }
    if (res.status === 401)
      throw new RudraError("unauthorized", strings.invalidCredentials);
    if (!res.ok) throw new RudraError("unhealthy", `Health check failed with HTTP ${res.status}`);
    const body = (await res.json()) as { healthy?: boolean; version?: string };
    return { healthy: body.healthy ?? true, version: body.version ?? "unknown" };
  }

  async requiresAuth(baseUrl: string): Promise<boolean> {
    const normalized = normalizeBaseUrl(baseUrl);
    if (!normalized) throw new RudraError("invalid_config", "Server URL is required");
    let res: Response;
    try {
      // Plain GET, no custom headers: a CORS simple request, no preflight.
      res = await globalThis.fetch(`${normalized}/global/health`);
    } catch (err) {
      throw new RudraError("unreachable", `Cannot reach server: ${(err as Error).message}`);
    }
    if (res.status === 401) return true;
    if (res.ok) return false;
    throw new RudraError("unhealthy", `Probe failed with HTTP ${res.status}`);
  }

  async listSessions(): Promise<import("@opencode-ai/sdk/client").Session[]> {
    const result = await this.requireClient().session.list();
    return unwrap(result, "List sessions");
  }

  async createSession(input: CreateSessionInput): Promise<import("@opencode-ai/sdk/client").Session> {
    const result = await this.requireClient().session.create({
      body: input.title ? { title: input.title } : {},
      ...(input.directory ? { query: { directory: input.directory } } : {}),
    });
    return unwrap(result, "Create session");
  }

  async getSession(id: string): Promise<import("@opencode-ai/sdk/client").Session> {
    const result = await this.requireClient().session.get({ path: { id } });
    return unwrap(result, "Get session");
  }

  async deleteSession(id: string): Promise<void> {
    const result = await this.requireClient().session.delete({ path: { id } });
    unwrap(result, "Delete session");
  }

  async getMessages(sessionID: string): Promise<MessageWithParts[]> {
    const result = await this.requireClient().session.messages({ path: { id: sessionID } });
    return unwrap(result, "List messages");
  }

  async getTodos(sessionID: string): Promise<import("@opencode-ai/sdk/client").Todo[]> {
    const result = await this.requireClient().session.todo({ path: { id: sessionID } });
    return unwrap(result, "List todos");
  }

  async replyPermission(
    sessionID: string,
    permissionID: string,
    response: "once" | "always" | "reject",
  ): Promise<void> {
    const result = await this.requireClient().postSessionIdPermissionsPermissionId({
      path: { id: sessionID, permissionID },
      body: { response },
    });
    unwrap(result, "Reply permission");
  }

  async sendPrompt(input: SendPromptInput): Promise<void> {
    const text = input.text.trim();
    if (!text) throw new RudraError("invalid_input", "Prompt text is required");
    const result = await this.requireClient().session.prompt({
      path: { id: input.sessionID },
      body: {
        ...(input.agent ? { agent: input.agent } : {}),
        ...(input.model ? { model: input.model } : {}),
        ...(input.system ? { system: input.system } : {}),
        ...(input.tools ? { tools: input.tools } : {}),
        parts: [{ type: "text", text }],
      },
    });
    unwrap(result, "Send prompt");
  }

  async abortSession(sessionID: string): Promise<void> {
    if (!sessionID) throw new RudraError("invalid_input", "Session ID is required");
    const result = await this.requireClient().session.abort({ path: { id: sessionID } });
    unwrap(result, "Abort session");
  }

  async listProviders(): Promise<import("./types").ProviderList> {
    const result = await this.requireClient().config.providers();
    return unwrap(result, "List providers");
  }

  async listAgents(): Promise<import("./types").Agent[]> {
    const result = await this.requireClient().app.agents();
    return unwrap(result, "List agents");
  }

  async importGitHub(username: string): Promise<{ profile: unknown; repos: unknown }> {
    const login = username.trim().replace(/^@/, "");
    if (!/^[A-Za-z0-9-]{1,39}$/.test(login)) {
      throw new RudraError("invalid_input", "Enter a valid GitHub username");
    }
    const headers = { Accept: "application/vnd.github+json" };
    let profileRes: Response;
    let reposRes: Response;
    try {
      [profileRes, reposRes] = await Promise.all([
        globalThis.fetch(`https://api.github.com/users/${login}`, { headers }),
        globalThis.fetch(`https://api.github.com/users/${login}/repos?per_page=30&sort=updated`, { headers }),
      ]);
    } catch (err) {
      throw new RudraError("unreachable", `GitHub request failed: ${(err as Error).message}`);
    }
    if (profileRes.status === 404) throw new RudraError("not_found", `GitHub user @${login} not found`);
    if (!profileRes.ok) throw new RudraError("server_error", `GitHub profile failed with HTTP ${profileRes.status}`);
    if (!reposRes.ok) throw new RudraError("server_error", `GitHub repos failed with HTTP ${reposRes.status}`);
    return { profile: await profileRes.json(), repos: await reposRes.json() };
  }

  subscribeToEvents(handler: RudraEventHandler): Unsubscribe {
    if (!this.client || !this.baseUrl) {
      logger.warn("subscribeToEvents called while disconnected; returning no-op");
      return () => undefined;
    }
    this.handlers.add(handler);
    void this.ensureStream();
    return () => {
      this.handlers.delete(handler);
      if (this.handlers.size === 0) this.stopStream();
    };
  }

  subscribeToStreamState(handler: StreamStateHandler): Unsubscribe {
    this.streamListeners.add(handler);
    return () => {
      this.streamListeners.delete(handler);
    };
  }

  private emitStream(state: StreamState): void {
    for (const h of [...this.streamListeners]) {
      try {
        h(state);
      } catch (err) {
        logger.error(err);
      }
    }
  }

  private stopStream(): void {
    const wasActive = this.sseRunning || this.reconnectTimer !== undefined;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.sseAbort?.abort();
    this.sseAbort = undefined;
    this.sseRunning = false;
    this.reconnectAttempt = 0;
    if (wasActive) this.emitStream("closed");
  }

  private scheduleReconnect(cause?: string): void {
    if (!this.client || this.handlers.size === 0 || this.reconnectTimer) return;
    const delay = nextReconnectDelay(this.reconnectAttempt++);
    logger.warn(
      `SSE stream error${cause ? `: ${cause}` : ""}, retrying in ${delay}ms (attempt ${this.reconnectAttempt})`,
    );
    this.emitStream("retrying");
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.ensureStream();
    }, delay);
  }

  private async ensureStream(): Promise<void> {
    if (this.sseRunning || !this.client || !this.baseUrl || this.handlers.size === 0) return;
    this.sseRunning = true;
    const abort = new AbortController();
    this.sseAbort = abort;
    const headers: Record<string, string> = { Accept: "text/event-stream" };
    if (this.authHeader) headers.Authorization = this.authHeader;
    try {
      const res = await globalThis.fetch(`${this.baseUrl}/global/event`, {
        headers,
        signal: abort.signal,
      });
      if (res.status === 401) {
        logger.error("SSE stream unauthorized (401)");
        this.emit({ type: "error", properties: { message: strings.invalidCredentials } });
        this.sseRunning = false;
        return;
      }
      if (!res.ok || !res.body) {
        throw new Error(`SSE request failed with HTTP ${res.status}`);
      }
      this.reconnectAttempt = 0;
      this.emitStream("open");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (abort.signal.aborted) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = splitSseBuffer(buffer, (data) => {
          if (devMode()) logRawEvent("sse", data.replace(/\s+/g, " "));
          handleSseData(data, (raw) => {
            const event = toRudraEvent(raw);
            if (event) this.emit(event);
          });
        });
      }
    } catch (err) {
      if (abort.signal.aborted) {
        this.sseRunning = false;
        return;
      }
      this.sseRunning = false;
      this.sseAbort = undefined;
      this.scheduleReconnect((err as Error).message);
      return;
    }
    this.sseRunning = false;
    this.sseAbort = undefined;
    // Server closed the stream while handlers remain: reconnect.
    if (this.client && this.handlers.size > 0 && !abort.signal.aborted) this.scheduleReconnect();
  }

  private emit(event: RudraEvent): void {
    if (devMode()) logRawEvent("app", event.type);
    for (const h of [...this.handlers]) {
      try {
        h(event);
      } catch (err) {
        logger.error(err);
      }
    }
  }
}

export const httpAdapter = new HttpBackendAdapter();
