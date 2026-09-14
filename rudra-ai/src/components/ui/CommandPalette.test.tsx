import { describe, expect, it } from "vitest";
import { filterActions, type CommandAction } from "./CommandPalette";

const actions: CommandAction[] = [
  { id: "session.new", title: "New Session", run: () => undefined },
  { id: "nav.settings", title: "Go to settings", run: () => undefined },
  { id: "session.export", title: "Export as Markdown", run: () => undefined },
];

describe("filterActions", () => {
  it("returns everything on an empty query", () => {
    expect(filterActions(actions, "")).toHaveLength(3);
    expect(filterActions(actions, "   ")).toHaveLength(3);
  });

  it("matches title and id case-insensitively", () => {
    expect(filterActions(actions, "session").map((a) => a.id)).toEqual(["session.new", "session.export"]);
    expect(filterActions(actions, "MARKDOWN").map((a) => a.id)).toEqual(["session.export"]);
    expect(filterActions(actions, "nav.").map((a) => a.id)).toEqual(["nav.settings"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterActions(actions, "zzz")).toEqual([]);
  });
});
