import { describe, expect, it } from "vitest";
import { isMechanical, pickCheapModel, routeTask, shouldEscalate } from "./tiers";
import type { Provider } from "../backend/types";

function prov(id: string, models: string[]): Provider {
  const m: Record<string, unknown> = {};
  for (const mid of models) m[mid] = { name: mid };
  return { id, name: id, source: "config", env: [], models: m } as unknown as Provider;
}

describe("isMechanical", () => {
  it("splits mechanical from judgment work", () => {
    expect(isMechanical("extract")).toBe(true);
    expect(isMechanical("parse-logs")).toBe(true);
    expect(isMechanical("edit")).toBe(false);
    expect(isMechanical("review")).toBe(false);
  });
});

describe("pickCheapModel", () => {
  it("prefers haiku-class models in hint order", () => {
    const p = pickCheapModel([prov("openai", ["gpt-4o", "gpt-4o-mini"]), prov("anthropic", ["claude-haiku-4-5"])]);
    expect(p).toEqual({ providerID: "anthropic", modelID: "claude-haiku-4-5" });
  });
  it("falls through provider list to any cheap match", () => {
    expect(pickCheapModel([prov("openai", ["gpt-4o", "gpt-4o-mini"])])).toEqual({
      providerID: "openai",
      modelID: "gpt-4o-mini",
    });
  });
  it("returns undefined with no cheap tier installed", () => {
    expect(pickCheapModel([prov("openai", ["gpt-4o"])])).toBeUndefined();
    expect(pickCheapModel([])).toBeUndefined();
  });
  it("never emits an empty model id", () => {
    expect(pickCheapModel([prov("ollama", [])])).toBeUndefined();
    const local = pickCheapModel([prov("ollama", ["qwen3:8b"])]);
    expect(local?.modelID).toBeTruthy();
  });
});

describe("routeTask", () => {
  const providers = [prov("openai", ["gpt-4o-mini"])];
  it("routes mechanical work cheap, judgment to frontier default", () => {
    expect(routeTask("extract", providers)).toMatchObject({ tier: "cheap" });
    expect(routeTask("summarize", providers).model?.modelID).toBe("gpt-4o-mini");
    expect(routeTask("edit", providers)).toEqual({ model: undefined, tier: "frontier" });
    expect(routeTask("review", providers).tier).toBe("frontier");
  });
  it("falls back to frontier when no cheap model exists", () => {
    expect(routeTask("extract", [prov("openai", ["gpt-4o"])])).toEqual({ model: undefined, tier: "frontier" });
  });
});

describe("shouldEscalate", () => {
  it("escalates on failed verification or low confidence", () => {
    expect(shouldEscalate({ verified: false })).toBe(true);
    expect(shouldEscalate({ confidence: 0.3 })).toBe(true);
    expect(shouldEscalate({ confidence: 0.9, verified: true })).toBe(false);
    expect(shouldEscalate({})).toBe(false);
  });
  it("respects custom thresholds", () => {
    expect(shouldEscalate({ confidence: 0.75 }, 0.8)).toBe(true);
    expect(shouldEscalate({ confidence: 0.75 }, 0.7)).toBe(false);
  });
});
