/** search_symbols: LSP-first navigation with tree-sitter/regex fallback. */
import type { FileEntry } from "./import-graph";
import { ToolError } from "./types";

export type SymbolKind = "definition" | "references" | "hover" | "implementations" | "workspace_symbol";

export interface SymbolLocation {
  file: string;
  line: number;
  character: number;
  signature: string;
  kind: string;
}

export interface SearchSymbolsInput {
  query: string;
  kind: SymbolKind;
  file?: string;
  line?: number;
  character?: number;
}

/** Minimal LSP client surface the tool talks to. Injected; fallback used when absent. */
export interface LspClient {
  request(kind: SymbolKind, input: SearchSymbolsInput): Promise<SymbolLocation[]>;
}

function lineOf(content: string, index: number): { line: number; character: number } {
  const upto = content.slice(0, index);
  const line = upto.split("\n").length;
  const lastNl = upto.lastIndexOf("\n");
  return { line, character: index - lastNl - 1 };
}

function stripComments(line: string): string {
  // naive: cut // and # comments (keeps strings mostly intact for search purposes)
  const cut = line.search(/(\/\/|#)/);
  return cut >= 0 ? line.slice(0, cut) : line;
}

/** Regex fallback: exact-word matches with signatures. Never throws. */
export function fallbackSearch(entries: FileEntry[], input: SearchSymbolsInput): SymbolLocation[] {
  const q = input.query;
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const word = new RegExp(`\\b${esc}\\b`);
  const declAdj = new RegExp(`\\b(function|class|interface|type|const|let|var|fn|def|struct|enum|trait)\\s+${esc}\\b`);
  const out: SymbolLocation[] = [];
  const scoped = input.file ? entries.filter((e) => e.path === input.file) : entries;
  for (const e of scoped) {
    const lines = e.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i] ?? "";
      const code = stripComments(raw);
      if (!word.test(code)) continue;
      if (input.kind === "definition") {
        // definition heuristic: declaration keyword adjacent to the symbol name,
        // so `const x = getUser()` is NOT a definition of getUser.
        if (!declAdj.test(code)) continue;
      }
      const idx = code.indexOf(q);
      out.push({
        file: e.path,
        line: i + 1,
        character: Math.max(0, idx),
        signature: raw.trim().slice(0, 160),
        kind: input.kind,
      });
      if (out.length >= 100) return out;
    }
  }
  return out;
}

/** Main entry: tries LSP, falls back to regex on unavailable/error. */
export async function searchSymbols(
  entries: FileEntry[],
  input: SearchSymbolsInput,
  lsp?: LspClient,
): Promise<{ locations: SymbolLocation[]; via: "lsp" | "fallback"; fallbackReason?: string }> {
  if (!input.query || !input.query.trim()) {
    throw new ToolError("BAD_INPUT", "query must be a non-empty string");
  }
  if (input.line !== undefined && (!Number.isInteger(input.line) || input.line < 1)) {
    throw new ToolError("BAD_INPUT", "line must be a positive integer");
  }
  if (input.character !== undefined && (!Number.isInteger(input.character) || input.character < 0)) {
    throw new ToolError("BAD_INPUT", "character must be a non-negative integer");
  }
  if (lsp) {
    try {
      const locations = await lsp.request(input.kind, input);
      return { locations: locations.slice(0, 100), via: "lsp" };
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      return { locations: fallbackSearch(entries, input), via: "fallback", fallbackReason: reason };
    }
  }
  return { locations: fallbackSearch(entries, input), via: "fallback", fallbackReason: "no LSP client" };
}

export function voidLineOfForTest(content: string, index: number): { line: number; character: number } {
  return lineOf(content, index);
}
