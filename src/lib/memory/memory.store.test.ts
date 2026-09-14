import { beforeEach, describe, expect, it } from "vitest";
import { memoryStore } from "./memory.store";
import { LocalStorageMemoryStore, MEMORY_STORAGE_KEY } from "./store.local";

describe("memoryStore", () => {
  beforeEach(() => {
    window.localStorage.removeItem(MEMORY_STORAGE_KEY);
    memoryStore.resetForTests();
  });

  it("loads empty and adds a manual memory", async () => {
    await memoryStore.load();
    expect(memoryStore.state.memories).toEqual([]);
    const mem = await memoryStore.add({ category: "identity", key: "name", value: "Rohith" });
    expect(mem.key).toBe("name");
    expect(memoryStore.active().length).toBe(1);
  });

  it("auto-marks contact as sensitive", async () => {
    const mem = await memoryStore.add({ category: "contact", key: "email", value: "r@example.com" });
    expect(mem.sensitive).toBe(true);
  });

  it("refuses secrets before storage", async () => {
    await expect(
      memoryStore.add({ category: "custom", key: "token", value: "sk-ant-abcdefgh12345678" }),
    ).rejects.toThrow(/Blocked/);
    expect(memoryStore.state.memories).toEqual([]);
  });

  it("supports injected impls", async () => {
    const { LocalStorageMemoryStore: LS } = await import("./store.local");
    expect(LS).toBe(LocalStorageMemoryStore);
  });
});
