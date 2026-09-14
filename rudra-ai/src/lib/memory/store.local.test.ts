import { beforeEach, describe, expect, it } from "vitest";
import { LocalStorageMemoryStore, MEMORY_STORAGE_KEY } from "./store.local";
import { normalizeKey } from "./store";

describe("normalizeKey", () => {
  it("lowercases and dot-separates", () => {
    expect(normalizeKey("  GitHub Username ")).toBe("github.username");
    expect(normalizeKey("project.axum-server")).toBe("project.axum.server");
  });
});

describe("LocalStorageMemoryStore", () => {
  let store: LocalStorageMemoryStore;

  beforeEach(() => {
    window.localStorage.removeItem(MEMORY_STORAGE_KEY);
    store = new LocalStorageMemoryStore();
  });

  it("starts empty and round-trips an insert", async () => {
    expect(await store.list()).toEqual([]);
    const mem = await store.upsert({ category: "social", key: "github", value: "@x" });
    expect(mem.status).toBe("active");
    expect((await store.list()).length).toBe(1);
  });

  it("supersedes on same category+key instead of duplicating", async () => {
    const first = await store.upsert({ category: "social", key: "github", value: "@old" });
    const second = await store.upsert({ category: "social", key: "github", value: "@new" });
    expect(second.supersedes).toBe(first.id);
    const all = await store.list();
    expect(all.length).toBe(2);
    expect(all.find((m) => m.id === first.id)?.status).toBe("archived");
    expect(all.find((m) => m.id === second.id)?.status).toBe("active");
  });

  it("updates value and flips status", async () => {
    const mem = await store.upsert({ category: "preferences", key: "editor", value: "vim" });
    const updated = await store.update(mem.id, { value: "neovim" });
    expect(updated.value).toBe("neovim");
    const archived = await store.setStatus(mem.id, "archived");
    expect(archived.status).toBe("archived");
  });

  it("removes and clears", async () => {
    const mem = await store.upsert({ category: "custom", key: "note", value: "hi" });
    await store.remove(mem.id);
    expect(await store.list()).toEqual([]);
    await store.upsert({ category: "custom", key: "a", value: "1" });
    await store.clear();
    expect(await store.list()).toEqual([]);
  });

  it("drops corrupt payloads instead of throwing", async () => {
    window.localStorage.setItem(MEMORY_STORAGE_KEY, "[{bad}, 42]");
    expect(await store.list()).toEqual([]);
  });

  it("proposes as pending without superseding", async () => {
    await store.upsert({ category: "social", key: "github", value: "@old" });
    const p = await store.propose({ category: "social", key: "github", value: "@new" });
    expect(p.status).toBe("pending");
    const all = await store.list();
    expect(all.find((m) => m.value === "@old")?.status).toBe("active");
  });

  it("approves pending and archives the conflicting active holder", async () => {
    const first = await store.upsert({ category: "social", key: "github", value: "@old" });
    const p = await store.propose({ category: "social", key: "github", value: "@new" });
    const approved = await store.approve(p.id);
    expect(approved.status).toBe("active");
    expect(approved.supersedes).toBe(first.id);
    expect((await store.get(first.id))?.status).toBe("archived");
  });

  it("confirms bump lastConfirmedAt without a new record", async () => {
    const m = await store.upsert({ category: "identity", key: "name", value: "Rohith" });
    const before = (await store.get(m.id))?.lastConfirmedAt ?? 0;
    await new Promise((r) => setTimeout(r, 2));
    const after = await store.confirm(m.id);
    expect(after.lastConfirmedAt).toBeGreaterThanOrEqual(before);
    expect(await store.list().then((l) => l.length)).toBe(1);
  });
});
