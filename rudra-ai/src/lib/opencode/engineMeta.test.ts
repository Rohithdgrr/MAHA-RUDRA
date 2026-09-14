import { describe, expect, it } from "vitest";
import { classifyEngine, filterEngines, type EngineEntry } from "./engineMeta";
import type { ModelOption } from "./models";

function opt(over: Partial<ModelOption>): ModelOption {
  return {
    providerID: "anthropic",
    providerName: "Anthropic",
    modelID: "claude-3-5-sonnet",
    modelName: "Claude 3.5 Sonnet",
    value: "anthropic/claude-3-5-sonnet",
    label: "Anthropic · Claude 3.5 Sonnet",
    ...over,
  };
}

describe("classifyEngine", () => {
  it("recognizes known models with badges", () => {
    const m = classifyEngine(opt({}));
    expect(m.category).toBe("fast");
    expect(m.tags).toContain("Recommended");
    expect(m.ctx).toBe("200k ctx");
  });

  it("detects local providers", () => {
    const m = classifyEngine(
      opt({
        providerID: "ollama",
        providerName: "Ollama",
        modelID: "qwen2.5-coder:32b",
        modelName: "Qwen 2.5 Coder 32B",
        value: "ollama/qwen2.5-coder:32b",
        label: "Ollama · Qwen 2.5 Coder 32B",
      }),
    );
    expect(m.category).toBe("local");
  });

  it("falls back to heuristics then standard", () => {
    expect(classifyEngine(opt({ modelID: "o1-preview", modelName: "o1" })).category).toBe(
      "reasoning",
    );
    expect(classifyEngine(opt({ modelID: "flash-lite", modelName: "Flash" })).category).toBe(
      "fast",
    );
    const std = classifyEngine(
      opt({ providerID: "acme", providerName: "Acme", modelID: "big-1", modelName: "Big" }),
    );
    expect(std.category).toBe("standard");
    expect(std.tags).toEqual([]);
  });
});

describe("filterEngines", () => {
  const entries: EngineEntry[] = [
    { option: opt({}), meta: classifyEngine(opt({})), active: true },
    {
      option: opt({
        providerID: "openai",
        providerName: "OpenAI",
        modelID: "gpt-4o",
        modelName: "GPT-4o",
        value: "openai/gpt-4o",
        label: "OpenAI · GPT-4o",
      }),
      meta: classifyEngine(opt({ modelID: "gpt-4o", modelName: "GPT-4o" })),
      active: false,
    },
  ];

  it("sorts active first", () => {
    const out = filterEngines([...entries].reverse(), "", "all");
    expect(out[0]?.active).toBe(true);
  });

  it("filters by tab and multi-word query", () => {
    expect(filterEngines(entries, "", "reasoning")).toHaveLength(0);
    expect(filterEngines(entries, "openai gpt", "all")).toHaveLength(1);
    expect(filterEngines(entries, "anthropic", "fast")).toHaveLength(1);
  });
});
