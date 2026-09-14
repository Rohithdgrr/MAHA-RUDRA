/** Frozen prompt framing: stable section order so server-side prefix caching hits.
 *
 *  Order is fixed — system → memory → tool-policy → user text — and separators
 *  are byte-stable. Anything before the first per-turn-varying section is the
 *  cacheable prefix. The server (`opencode serve`) manages the actual cache;
 *  this module guarantees we stop invalidating it by reordering.
 */
import { estimateTokens } from "../utils/tokens";

export interface PromptParts {
  system?: string;
  memoryBlock?: string;
  toolPolicy?: string;
  userText: string;
}

export interface FramedSection {
  name: "system" | "memory" | "tool-policy" | "user";
  tokens: number;
  /** Stable across turns within a session (safe prefix-cache boundary). */
  cacheSafe: boolean;
}

export interface FramedPrompt {
  text: string;
  sections: FramedSection[];
  /** Tokens before the first turn-varying section. */
  cacheablePrefixTokens: number;
}

/** Assemble in frozen order. Pure — same inputs always yield byte-identical output. */
export function assemblePrompt(parts: PromptParts): FramedPrompt {
  if (!parts.userText.trim()) {
    throw new Error("userText must be non-empty");
  }
  const sections: FramedSection[] = [];
  const chunks: string[] = [];
  const push = (name: FramedSection["name"], body: string | undefined, cacheSafe: boolean) => {
    const text = (body ?? "").trim();
    if (!text) return;
    chunks.push(text);
    sections.push({ name, tokens: estimateTokens(text), cacheSafe });
  };
  // FROZEN ORDER — do not reorder without bumping PROMPT_FRAME_VERSION.
  push("system", parts.system, true);
  push("memory", parts.memoryBlock, true);
  push("tool-policy", parts.toolPolicy, true);
  push("user", parts.userText, false);
  let cacheablePrefixTokens = 0;
  for (const s of sections) {
    if (!s.cacheSafe) break;
    cacheablePrefixTokens += s.tokens;
  }
  return { text: chunks.join("\n\n"), sections, cacheablePrefixTokens };
}

/** Schema marker: bump when the frozen order or separators change (invalidates prefix cache). */
export const PROMPT_FRAME_VERSION = 1;
