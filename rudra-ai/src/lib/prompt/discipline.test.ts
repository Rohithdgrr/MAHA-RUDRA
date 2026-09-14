import { describe, expect, it } from "vitest";
import { SUMMARY_TOKENS, capOutput, citeRef, statusUpdate, stripPreamble, taskResult } from "./discipline";

describe("citeRef", () => {
  it("formats file:line pointers", () => {
    expect(citeRef("src\\api.ts", 44)).toBe("`src/api.ts:44`");
    expect(citeRef("", -3)).toBe("`unknown:1`");
  });
});

describe("stripPreamble", () => {
  it("drops greetings and hedged openers", () => {
    expect(stripPreamble("Hi there!\nLet me look at this.\nThe fix is X.")).toBe("The fix is X.");
    expect(stripPreamble("I'll now check the logs.\nFound it.")).toBe("Found it.");
    expect(stripPreamble("Sure, here's what I found.\nDetails.")).toBe("Details.");
  });
  it("keeps direct results untouched", () => {
    expect(stripPreamble("Fixed `src/a.ts:3`.")).toBe("Fixed `src/a.ts:3`.");
    expect(stripPreamble("")).toBe("");
  });
});

describe("taskResult", () => {
  it("emits structured finals, caps artifacts", () => {
    const r = JSON.parse(taskResult("done", ["a", "b"], "all green")) as { status: string; artifacts: string[] };
    expect(r).toMatchObject({ status: "done", artifacts: ["a", "b"] });
    expect(JSON.parse(taskResult("failed")) as { artifacts: string[] }).toEqual({ status: "failed", artifacts: [] });
  });
});

describe("capOutput + statusUpdate", () => {
  it("caps long output with a marker", () => {
    const capped = capOutput("x".repeat(1000), 10);
    expect(capped.length).toBeLessThan(1000);
    expect(capped).toContain("[capped]");
    expect(capOutput("short", 500)).toBe("short");
    expect(capOutput("x", 0)).toBe("");
  });
  it("statusUpdate takes the first signal line", () => {
    expect(statusUpdate("Let me see.\nPatched auth.\nMore detail.")).toBe("Patched auth.");
    expect(SUMMARY_TOKENS).toBe(500);
  });
});
