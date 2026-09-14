import { describe, expect, it } from "vitest";
import {
  directoriesEqual,
  folderBasename,
  nextSessionAfterDelete,
  normalizeDirectory,
  resolveFolderOpen,
} from "./folders";

describe("normalizeDirectory", () => {
  it("trims quotes and whitespace", () => {
    expect(normalizeDirectory('  "C:\\proj\\app"  ')).toBe("C:\\proj\\app");
    expect(normalizeDirectory("  ")).toBeUndefined();
    expect(normalizeDirectory(null)).toBeUndefined();
  });

  it("drops trailing separators except roots", () => {
    expect(normalizeDirectory("/home/you/proj/")).toBe("/home/you/proj");
    expect(normalizeDirectory("C:\\proj\\")).toBe("C:\\proj");
    expect(normalizeDirectory("/")).toBe("/");
    expect(normalizeDirectory("C:\\")).toBe("C:\\");
  });
});

describe("folderBasename", () => {
  it("returns the last segment", () => {
    expect(folderBasename("C:\\Users\\rohit\\proj")).toBe("proj");
    expect(folderBasename("/home/you/proj/")).toBe("proj");
    expect(folderBasename("")).toBe("");
  });
});

describe("directoriesEqual", () => {
  it("compares slash-insensitively and case-insensitively on Windows", () => {
    expect(directoriesEqual("C:\\proj\\app", "c:/proj/app/")).toBe(true);
    expect(directoriesEqual("/home/a", "/home/b")).toBe(false);
    expect(directoriesEqual(undefined, "/home/a")).toBe(false);
  });
});

describe("resolveFolderOpen", () => {
  const sessions = [
    { id: "old", directory: "/tmp/a", time: { created: 1, updated: 1 } },
    { id: "new", directory: "/tmp/a", time: { created: 1, updated: 5 } },
    { id: "other", directory: "/tmp/b", time: { created: 1, updated: 9 } },
  ] as never;

  it("reuses the most recent session in the same folder", () => {
    expect(resolveFolderOpen(sessions, "/tmp/a")).toEqual({ action: "switch", sessionID: "new" });
    expect(resolveFolderOpen(sessions, "/tmp/a/")).toEqual({ action: "switch", sessionID: "new" });
  });

  it("creates when no session covers the folder", () => {
    expect(resolveFolderOpen(sessions, "/tmp/c")).toEqual({ action: "create" });
    expect(resolveFolderOpen(sessions, "  ")).toEqual({ action: "create" });
  });
});

describe("nextSessionAfterDelete", () => {
  it("picks the most recent remaining session", () => {
    const sessions = [
      { id: "a", time: { created: 1, updated: 3 } },
      { id: "b", time: { created: 1, updated: 7 } },
      { id: "c", time: { created: 1, updated: 5 } },
    ] as never;
    expect(nextSessionAfterDelete(sessions, "b")).toBe("c");
    expect(nextSessionAfterDelete(sessions, "x")).toBe("b");
    expect(nextSessionAfterDelete([{ id: "only", time: { created: 1, updated: 1 } }] as never, "only")).toBeUndefined();
  });
});
