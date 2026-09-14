import { describe, expect, it } from "vitest";
import { indexedDBAvailable, resolveMemoryStore } from "./store.idb";
import { LocalStorageMemoryStore } from "./store.local";

describe("resolveMemoryStore", () => {
  it("falls back to localStorage when IndexedDB is unavailable", async () => {
    if (indexedDBAvailable()) return;
    const store = await resolveMemoryStore();
    expect(store).toBeInstanceOf(LocalStorageMemoryStore);
    expect(await store.list()).toEqual([]);
    const mem = await store.upsert({ category: "custom", key: "k", value: "v" });
    expect((await store.get(mem.id))?.value).toBe("v");
    await store.clear();
  });
});
