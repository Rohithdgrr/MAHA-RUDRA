import type { ModelOption } from "./models";

export type EngineCategory = "fast" | "reasoning" | "local" | "standard";
export type EngineTab = "all" | "fast" | "reasoning" | "local";

export interface EngineMeta {
  category: EngineCategory;
  /** Small pill badges shown next to the model name. */
  tags: string[];
  /** Context badge, e.g. "200k ctx". Undefined = unknown. */
  ctx?: string;
  /** One-line provider/capability description. */
  blurb: string;
}

interface KnownEngine {
  match: string[];
  category: EngineCategory;
  tags: string[];
  ctx?: string;
  blurb: string;
}

/** Local know-how for common models (the server API returns no metadata). */
const KNOWN: KnownEngine[] = [
  {
    match: ["claude-3-5-sonnet", "3.5 sonnet"],
    category: "fast",
    tags: ["Recommended"],
    ctx: "200k ctx",
    blurb: "Fast multimodal coding",
  },
  {
    match: ["claude-3-7", "3.7 sonnet", "thinking"],
    category: "reasoning",
    tags: ["New", "Thinking"],
    ctx: "200k ctx",
    blurb: "Hybrid Reasoning",
  },
  {
    match: ["gpt-4o"],
    category: "fast",
    tags: ["High Speed"],
    ctx: "128k ctx",
    blurb: "Flagship Omni Engine",
  },
  {
    match: ["deepseek-r1", "deepseek-reasoner"],
    category: "reasoning",
    tags: ["Open Weights"],
    ctx: "64k ctx",
    blurb: "Self-hosted reasoning",
  },
  {
    match: ["qwen", "coder"],
    category: "local",
    tags: ["Local Daemon"],
    blurb: "Local code instruct",
  },
  {
    match: ["deepseek"],
    category: "reasoning",
    tags: ["Open Weights"],
    blurb: "Self-hosted reasoning",
  },
];

const LOCAL_PROVIDERS = ["ollama", "lmstudio", "llamacpp", "local", "jan", "gpt4all"];

/** Classify a model option into a category + badges. Pure. */
export function classifyEngine(opt: Pick<ModelOption, "providerID" | "providerName" | "modelID" | "modelName">): EngineMeta {
  const hay = `${opt.providerID} ${opt.providerName} ${opt.modelID} ${opt.modelName}`.toLowerCase();
  for (const k of KNOWN) {
    if (k.match.some((m) => hay.includes(m))) {
      return { category: k.category, tags: [...k.tags], ctx: k.ctx, blurb: k.blurb };
    }
  }
  if (LOCAL_PROVIDERS.some((p) => hay.includes(p))) {
    return { category: "local", tags: ["Local"], blurb: "On-device inference" };
  }
  if (/reason|think|r1|o1|o3/.test(hay)) {
    return { category: "reasoning", tags: [], blurb: "Deliberative reasoning" };
  }
  if (/flash|mini|haiku|turbo|fast|speed/.test(hay)) {
    return { category: "fast", tags: [], blurb: "Low-latency chat" };
  }
  return { category: "standard", tags: [], blurb: opt.providerName };
}

export interface EngineEntry {
  option: ModelOption;
  meta: EngineMeta;
  active: boolean;
}

/** Filter + sort entries for the engine modal. Pure. */
export function filterEngines(
  entries: EngineEntry[],
  query: string,
  tab: EngineTab,
): EngineEntry[] {
  const q = query.trim().toLowerCase();
  const out = entries.filter((e) => {
    if (tab !== "all" && e.meta.category !== tab) return false;
    if (!q) return true;
    const hay =
      `${e.option.modelName} ${e.option.modelID} ${e.option.providerName} ${e.option.providerID}`.toLowerCase();
    return q.split(/\s+/).every((w) => hay.includes(w));
  });
  const rank = (e: EngineEntry) => (e.active ? 0 : e.meta.tags.length > 0 ? 1 : 2);
  return out.sort(
    (a, b) => rank(a) - rank(b) || a.option.label.localeCompare(b.option.label),
  );
}
