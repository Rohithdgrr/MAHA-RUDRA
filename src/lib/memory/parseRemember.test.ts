import { describe, expect, it } from "vitest";
import { guessCategory, parseRemember } from "./parseRemember";

describe("parseRemember", () => {
  it("returns undefined for normal chat", () => {
    expect(parseRemember("how do I reverse a list in rust?")).toBeUndefined();
    expect(parseRemember("")).toBeUndefined();
  });

  it("parses remember my X is Y", () => {
    const r = parseRemember("remember my github is @Rohithdgrr");
    expect(r).toMatchObject({ kind: "save", category: "social", key: "github", value: "@Rohithdgrr" });
  });

  it("parses slash add with dotted category", () => {
    const r = parseRemember("/memory add preferences.editor = Neovim");
    expect(r).toMatchObject({ kind: "save", category: "preferences", key: "editor", value: "Neovim" });
  });

  it("parses key=value payloads", () => {
    const r = parseRemember("please remember editor: Neovim");
    expect(r?.kind).toBe("save");
    if (r?.kind === "save") expect(r.value).toBe("Neovim");
  });

  it("parses forget commands", () => {
    const r = parseRemember("forget my github");
    expect(r).toMatchObject({ kind: "forget", key: "github" });
    expect(parseRemember("/memory forget github")).toMatchObject({ kind: "forget", key: "github" });
  });

  it("falls back to a custom note for freeform payloads", () => {
    const r = parseRemember("keep in mind I deploy on Fridays");
    expect(r?.kind).toBe("save");
  });
});

describe("guessCategory", () => {
  it("maps known keys", () => {
    expect(guessCategory("github", "@x")).toBe("social");
    expect(guessCategory("email", "a@b.c")).toBe("contact");
    expect(guessCategory("editor", "Neovim")).toBe("preferences");
    expect(guessCategory("nickname", "bob")).toBe("custom");
  });
});
