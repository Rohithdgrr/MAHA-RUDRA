import { beforeEach, describe, expect, it } from "vitest";
import { AUDIT_STORAGE_KEY, clearAudit, listAudit, logAudit } from "./audit";

describe("audit", () => {
  beforeEach(() => {
    window.localStorage.removeItem(AUDIT_STORAGE_KEY);
  });

  it("starts empty and round-trips entries", () => {
    expect(listAudit()).toEqual([]);
    logAudit("add", { memoryId: "a" });
    logAudit("remove", { memoryId: "b" });
    const all = listAudit();
    expect(all.length).toBe(2);
    expect(all.map((e) => e.action).sort()).toEqual(["add", "remove"]);
    expect(all.map((e) => e.memoryId).sort()).toEqual(["a", "b"]);
  });

  it("clears", () => {
    logAudit("add");
    clearAudit();
    expect(listAudit()).toEqual([]);
    expect(window.localStorage.getItem(AUDIT_STORAGE_KEY)).toBeNull();
  });

  it("drops corrupt payloads", () => {
    window.localStorage.setItem(AUDIT_STORAGE_KEY, "[{bad}, 42]");
    expect(listAudit()).toEqual([]);
  });
});
