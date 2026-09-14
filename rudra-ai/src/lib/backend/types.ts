import type {
  Agent,
  Event as ServerEvent,
  Message,
  Model,
  Part,
  Provider,
  Session,
  SessionStatus,
} from "@opencode-ai/sdk/client";

export type { Agent, Message, Model, Part, Provider, Session, SessionStatus, ServerEvent };

export interface MessageWithParts {
  info: Message;
  parts: Part[];
}

export interface CreateSessionInput {
  title?: string;
  directory?: string;
}

export interface SendPromptInput {
  sessionID: string;
  text: string;
  agent?: string;
  model?: { providerID: string; modelID: string };
  /** System prompt override (used by local personas). */
  system?: string;
  /** Tool allow-list override (used by local personas). */
  tools?: Record<string, boolean>;
}

export interface ModelSelection {
  providerID: string;
  modelID: string;
}

export interface ProviderList {
  providers: Provider[];
  /** Server-side default model per agent, if configured. */
  default: Record<string, string>;
}

export interface ConnectConfig {
  baseUrl: string;
  username?: string;
  password?: string;
}

export interface ServerHealth {
  healthy: boolean;
  version: string;
}

export type Todo = import("@opencode-ai/sdk/client").Todo;
export type Permission = import("@opencode-ai/sdk/client").Permission;

export type RudraEvent =
  | { type: "server.connected"; properties: { version?: string } }
  | { type: "session.created"; properties: { sessionID: string; session?: Session } }
  | { type: "session.updated"; properties: { sessionID: string; session?: Session } }
  | { type: "session.deleted"; properties: { sessionID: string } }
  | { type: "session.status"; properties: { sessionID: string; status: SessionStatus } }
  | { type: "session.idle"; properties: { sessionID: string } }
  | { type: "session.error"; properties: { sessionID?: string; message: string } }
  | { type: "message.updated"; properties: { sessionID: string; message: Message } }
  | { type: "message.removed"; properties: { sessionID: string; messageID: string } }
  | {
       type: "message.part.updated";
       properties: { sessionID: string; messageID: string; partID: string; part: Part; delta?: string };
     }
  | { type: "message.part.removed"; properties: { sessionID: string; messageID: string; partID: string } }
  | { type: "tool.execution.started"; properties: { sessionID: string; toolID: string } }
  | { type: "tool.execution.completed"; properties: { sessionID: string; toolID: string } }
  | { type: "todo.updated"; properties: { sessionID: string; todos: Todo[] } }
  | { type: "permission.updated"; properties: Permission }
  | { type: "permission.replied"; properties: { sessionID: string; permissionID: string } }
  | { type: "error"; properties: { message: string } };

/**
 * Normalize a raw `opencode serve` SSE payload (`GlobalEvent.payload`)
 * into the smaller `RudraEvent` shape the UI consumes. Returns undefined
 * for events the UI intentionally ignores (lsp, pty, …).
 */
export function toRudraEvent(raw: ServerEvent): RudraEvent | undefined {
  switch (raw.type) {
    case "server.connected":
      return { type: "server.connected", properties: {} };
    case "session.created":
      return {
        type: "session.created",
        properties: { sessionID: raw.properties.info.id, session: raw.properties.info },
      };
    case "session.updated":
      return {
        type: "session.updated",
        properties: { sessionID: raw.properties.info.id, session: raw.properties.info },
      };
    case "session.deleted":
      return { type: "session.deleted", properties: { sessionID: raw.properties.info.id } };
    case "session.status":
      return { type: "session.status", properties: { ...raw.properties } };
    case "session.idle":
      return { type: "session.idle", properties: { ...raw.properties } };
    case "session.error":
      return {
        type: "session.error",
        properties: {
          sessionID: (raw.properties as { sessionID?: string }).sessionID,
          message:
            (raw.properties as { error?: { data?: { message?: string }; message?: string } }).error?.data
              ?.message ??
            (raw.properties as { error?: { message?: string } }).error?.message ??
            "Session error",
        },
      };
    case "message.updated":
      return {
        type: "message.updated",
        properties: { sessionID: raw.properties.info.sessionID, message: raw.properties.info },
      };
    case "message.removed":
      return { type: "message.removed", properties: { ...raw.properties } };
    case "message.part.updated":
      return {
        type: "message.part.updated",
        properties: {
          sessionID: raw.properties.part.sessionID,
          messageID: raw.properties.part.messageID,
          partID: raw.properties.part.id,
          part: raw.properties.part,
          delta: raw.properties.delta,
        },
      };
    case "message.part.removed":
      return { type: "message.part.removed", properties: { ...raw.properties } };
    case "todo.updated":
      return {
        type: "todo.updated",
        properties: {
          sessionID: (raw.properties as { sessionID: string }).sessionID,
          todos: (raw.properties as { todos: import("@opencode-ai/sdk/client").Todo[] }).todos ?? [],
        },
      };
    case "permission.updated":
      return {
        type: "permission.updated",
        properties: raw.properties as Permission,
      };
    case "permission.replied":
      return {
        type: "permission.replied",
        properties: raw.properties as { sessionID: string; permissionID: string },
      };
    default:
      return undefined;
  }
}

export type RudraEventHandler = (event: RudraEvent) => void;
export type Unsubscribe = () => void;

/** Lifecycle of the multiplexed SSE stream. `retrying` carries backoff attempts. */
export type StreamState = "open" | "retrying" | "closed";
export type StreamStateHandler = (state: StreamState) => void;

export class RudraError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "RudraError";
    this.code = code;
  }
}

/**
 * Single seam for all server I/O. Components must never call
 * fetch/EventSource or import the OpenCode SDK directly.
 */
export interface BackendAdapter {
  connect(config: ConnectConfig): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;

  listSessions(): Promise<Session[]>;
  createSession(input: CreateSessionInput): Promise<Session>;
  getSession(id: string): Promise<Session>;
  deleteSession(id: string): Promise<void>;
  getMessages(sessionID: string): Promise<MessageWithParts[]>;
  getTodos(sessionID: string): Promise<import("@opencode-ai/sdk/client").Todo[]>;

  replyPermission(
    sessionID: string,
    permissionID: string,
    response: "once" | "always" | "reject",
  ): Promise<void>;

  sendPrompt(input: SendPromptInput): Promise<void>;
  /** Abort the running turn in `sessionID` (`POST /session/{id}/abort`). */
  abortSession(sessionID: string): Promise<void>;
  /** Configured providers + models (`GET /config/providers`). */
  listProviders(): Promise<ProviderList>;
  /** Agents known to the server (`GET /agent`). */
  listAgents(): Promise<Agent[]>;
  /**
   * Public GitHub profile + repos for memory import (Phase 6). Raw JSON —
   * the caller validates via `githubToCandidates`. No auth, no secrets.
   */
  importGitHub(username: string): Promise<{ profile: unknown; repos: unknown }>;
  /**
   * Multiplexed SSE subscription to `/global/event`. Many callers may
   * subscribe; the adapter holds a single HTTP stream and fans out.
   * The returned function removes that handler; the stream closes when
   * the last handler unsubscribes or `disconnect()` is called.
   */
  subscribeToEvents(handler: RudraEventHandler): Unsubscribe;
  /**
   * SSE stream lifecycle for reconnect UI. The adapter owns timers;
   * subscribers only render. Closed fires when the last handler leaves
   * or `disconnect()` runs; no event fires while never connected.
   */
  subscribeToStreamState(handler: StreamStateHandler): Unsubscribe;

  health(): Promise<ServerHealth>;
  /**
   * Anonymous probe: does `baseUrl` require HTTP Basic auth?
   * Returns true on HTTP 401, false on HTTP 200. Throws RudraError
   * (unreachable/unhealthy) otherwise. Never sends credentials.
   */
  requiresAuth(baseUrl: string): Promise<boolean>;
}
