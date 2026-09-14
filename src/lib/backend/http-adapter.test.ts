import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpBackendAdapter, handleSseData, splitSseBuffer } from "./http-adapter";
import { RudraError, toRudraEvent } from "./types";
import type { RudraEvent } from "./types";
import type { Event as ServerEvent } from "@opencode-ai/sdk/client";

function mockHealthFetch(version = "1.18.30") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ healthy: true, version }),
    ) as unknown as typeof fetch,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HttpBackendAdapter", () => {
  it("connects and reports health with a mocked server", async () => {
    mockHealthFetch();
    const adapter = new HttpBackendAdapter();
    await adapter.connect({ baseUrl: "http://localhost:4096/" });
    expect(adapter.isConnected()).toBe(true);
    const health = await adapter.health();
    expect(health).toEqual({ healthy: true, version: "1.18.30" });
    adapter.disconnect();
    expect(adapter.isConnected()).toBe(false);
  });

  it("strips trailing slashes from the base URL", async () => {
    mockHealthFetch("9.9.9");
    const adapter = new HttpBackendAdapter();
    await adapter.connect({ baseUrl: "http://localhost:4096///" });
    const health = await adapter.health();
    expect(health.version).toBe("9.9.9");
  });

  it("throws RudraError when the server is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connection refused");
      }) as unknown as typeof fetch,
    );
    const adapter = new HttpBackendAdapter();
    await expect(adapter.connect({ baseUrl: "http://localhost:4096" })).rejects.toBeInstanceOf(RudraError);
  });

  it("throws RudraError on 401 with bad credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unauthorized", { status: 401 })) as unknown as typeof fetch,
    );
    const adapter = new HttpBackendAdapter();
    await expect(
      adapter.connect({ baseUrl: "http://localhost:4096", password: "wrong" }),
    ).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("subscribeToEvents returns a no-op when disconnected", () => {
    const adapter = new HttpBackendAdapter();
    const unsub = adapter.subscribeToEvents(() => undefined);
    expect(typeof unsub).toBe("function");
    expect(() => unsub()).not.toThrow();
  });

  it("abortSession throws when disconnected", async () => {
    const adapter = new HttpBackendAdapter();
    await expect(adapter.abortSession("s1")).rejects.toBeInstanceOf(RudraError);
  });

  it("requiresAuth detects a protected server (401)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unauthorized", { status: 401 })) as unknown as typeof fetch,
    );
    const adapter = new HttpBackendAdapter();
    await expect(adapter.requiresAuth("http://localhost:4096")).resolves.toBe(true);
  });

  it("requiresAuth detects an open server (200)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ healthy: true, version: "x" })) as unknown as typeof fetch,
    );
    const adapter = new HttpBackendAdapter();
    await expect(adapter.requiresAuth("http://localhost:4096")).resolves.toBe(false);
  });

  it("requiresAuth throws when the server is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connection refused");
      }) as unknown as typeof fetch,
    );
    const adapter = new HttpBackendAdapter();
    await expect(adapter.requiresAuth("http://localhost:4096")).rejects.toBeInstanceOf(RudraError);
  });
});

function urlOf(input: unknown): string {
  if (typeof input === "string") return input;
  if (input instanceof Request) return input.url;
  return String(input);
}

function sseResponse(chunks: string[]): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
}

describe("SSE streaming (Phase 2)", () => {
  it("splitSseBuffer extracts data payloads and keeps the tail", () => {
    const seen: string[] = [];
    const tail = splitSseBuffer(
      'data: {"a":1}\n\ndata: {"b":2}\n\npartial',
      (d) => seen.push(d),
    );
    expect(seen).toEqual(['{"a":1}', '{"b":2}']);
    expect(tail).toBe("partial");
  });

  it("handleSseData unwraps GlobalEvent payloads and ignores garbage", () => {
    const seen: ServerEvent[] = [];
    handleSseData(
      JSON.stringify({ directory: "/tmp", payload: { type: "session.idle", properties: { sessionID: "s1" } } }),
      (e) => seen.push(e),
    );
    handleSseData(JSON.stringify({ type: "session.idle", properties: { sessionID: "s2" } }), (e) =>
      seen.push(e),
    );
    handleSseData("not json at all", (e) => seen.push(e));
    handleSseData("   ", (e) => seen.push(e));
    expect(seen).toHaveLength(2);
    expect(seen[0]).toMatchObject({ type: "session.idle" });
  });

  it("toRudraEvent maps server events and drops ignored ones", () => {
    const part = {
      id: "p1",
      sessionID: "s1",
      messageID: "m1",
      type: "text",
      text: "hello",
    };
    const mapped = toRudraEvent({
      type: "message.part.updated",
      properties: { part, delta: " world" },
    } as unknown as ServerEvent);
    expect(mapped).toMatchObject({
      type: "message.part.updated",
      properties: { sessionID: "s1", messageID: "m1", partID: "p1", delta: " world" },
    });
    const status = toRudraEvent({
      type: "session.status",
      properties: { sessionID: "s1", status: { type: "busy" } },
    } as unknown as ServerEvent);
    expect(status).toMatchObject({ type: "session.status" });
    expect(
      toRudraEvent({ type: "todo.updated", properties: {} } as unknown as ServerEvent),
    ).toBeUndefined();
  });

  it("fans out GlobalEvent payloads to all subscribers over one connection", async () => {
    const payload = {
      directory: "/tmp",
      payload: { type: "session.idle", properties: { sessionID: "s1" } },
    };
    const fetchMock = vi.fn(async (input: unknown, _init?: RequestInit) => {
      void _init;
      const url = urlOf(input);
      if (url.endsWith("/global/health")) return Response.json({ healthy: true, version: "x" });
      if (url.endsWith("/global/event")) return sseResponse([`data: ${JSON.stringify(payload)}\n\n`]);
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const adapter = new HttpBackendAdapter();
    await adapter.connect({ baseUrl: "http://localhost:4096", password: "secret" });
    const seenA: RudraEvent[] = [];
    const seenB: RudraEvent[] = [];
    const unA = adapter.subscribeToEvents((e) => seenA.push(e));
    const unB = adapter.subscribeToEvents((e) => seenB.push(e));
    await vi.waitFor(() => expect(seenA.length).toBe(1));
    expect(seenB).toHaveLength(1);
    expect(seenA[0]).toMatchObject({ type: "session.idle", properties: { sessionID: "s1" } });

    const sseCalls = fetchMock.mock.calls.filter(([u]) => urlOf(u).endsWith("/global/event"));
    expect(sseCalls).toHaveLength(1);
    expect((sseCalls[0]?.[1]?.headers as Record<string, string>).Authorization).toMatch(/^Basic /);

    unA();
    unB();
    adapter.disconnect();
  }, 10000);
});
