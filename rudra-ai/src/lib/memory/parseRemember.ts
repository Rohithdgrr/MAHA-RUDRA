import type { MemoryCategory } from "./types";
import { isMemoryCategory } from "./types";
import { normalizeKey } from "./store";

export interface ParsedSave {
  kind: "save";
  category: MemoryCategory;
  key: string;
  rawKey: string;
  value: string;
  confidence: number;
}

export interface ParsedForget {
  kind: "forget";
  key: string;
  rawKey: string;
}

export type ParsedRemember = ParsedSave | ParsedForget;

const SAVE_TRIGGERS = /(remember|note that|save this|keep in mind|don't forget|do not forget)\b/i;
const FORGET_RE = /^\s*(please\s+)?(forget|don't remember|do not remember|remove from memory)\b\s*(that\s+)?(.*)$/i;
const SLASH_ADD_RE = /^\s*\/memory\s+add\s+(.+)$/is;
const SLASH_FORGET_RE = /^\s*\/memory\s+(forget|rm|remove|delete)\s+(.+)$/is;
const MY_X_IS_Y = /\bmy\s+([a-z0-9][a-z0-9 _.-]{0,40}?)\s+(is|are|:|=)\s+(.+)$/i;
const I_USE = /\bi\s+(use|prefer|like)\s+(.+)$/i;
const KV_RE = /^\s*([a-z][a-z0-9_.-]*)\s*[:=]\s*(.+)\s*$/i;
const DOTTED_RE = /^\s*([a-z]+)\.([a-z0-9_.-]+)\s*[:=]\s*(.+)\s*$/i;

function cleanValue(v: string): string {
  return v.trim().replace(/^[“"']+|[.”"']+$/g, "").replace(/\s+$/g, "").trim().slice(0, 500);
}

function cleanKeyPhrase(v: string): string {
  return v.trim().replace(/^(my|the)\s+/i, "").replace(/[?.!]+$/g, "").trim().slice(0, 60);
}

/** Map a key phrase to a category. Pure heuristic; user can recategorize in Settings. */
export function guessCategory(keyPhrase: string, value: string): MemoryCategory {
  const k = keyPhrase.toLowerCase();
  const v = `${keyPhrase} ${value}`.toLowerCase();
  if (/\b(email|phone|contact|address)\b/.test(k)) return "contact";
  if (/\b(github|gitlab|linkedin|\bx\b|twitter|portfolio|site|website|dribbble)\b/.test(k)) return "social";
  if (/\b(editor|theme|font|terminal|shell|stack|backend|frontend|design|style|workflow|neovim|vim|vscode)\b/.test(v)) return "preferences";
  if (/\b(uses|use|prefer|prefers|likes)\b/.test(k)) return "preferences";
  if (/\b(project|building|working on)\b/.test(k)) return "projects";
  if (/\b(won|award|shipped|achievement|completed)\b/.test(v)) return "achievements";
  if (/\b(work|job|role|employer|company)\b/.test(k)) return "resume";
  if (/\b(degree|university|college|education|skill)\b/.test(k)) return "cv";
  if (/\b(name|pronouns|location|timezone|language)\b/.test(k)) return "identity";
  return "custom";
}

function saveFor(rawKey: string, value: string): ParsedSave | undefined {
  const keyPhrase = cleanKeyPhrase(rawKey);
  const val = cleanValue(value);
  if (!keyPhrase || !val) return undefined;
  const key = normalizeKey(keyPhrase);
  if (!key) return undefined;
  return { kind: "save", category: guessCategory(keyPhrase, val), key, rawKey: keyPhrase, value: val, confidence: 1 };
}

function parsePayload(payload: string): ParsedSave | undefined {
  const text = payload.trim();
  if (!text) return undefined;
  const dotted = text.match(DOTTED_RE);
  if (dotted) {
    const [, cat, key, val] = dotted as [string, string, string, string];
    if (isMemoryCategory(cat) && key && val) {
      const v = cleanValue(val);
      if (v) return { kind: "save", category: cat, key: normalizeKey(key), rawKey: key, value: v, confidence: 1 };
    }
  }
  const my = text.match(MY_X_IS_Y);
  if (my) return saveFor(my[1] ?? "", my[3] ?? "");
  const kv = text.match(KV_RE);
  if (kv) return saveFor(kv[1] ?? "", kv[2] ?? "");
  const use = text.match(I_USE);
  if (use) {
    const verb = (use[1] ?? "").toLowerCase();
    const val = cleanValue(use[2] ?? "");
    if (val) return saveFor(verb === "prefer" ? "preference" : "tool", val);
  }
  if (text.length <= 200) return saveFor("note", text);
  return undefined;
}

/**
 * Parse an explicit memory command. Returns undefined for normal chat.
 * Pure and synchronous — safe to run on every send.
 */
export function parseRemember(text: string): ParsedRemember | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const slashAdd = t.match(SLASH_ADD_RE);
  if (slashAdd) return parsePayload(slashAdd[1] ?? "");
  const slashForget = t.match(SLASH_FORGET_RE);
  if (slashForget) {
    const raw = cleanKeyPhrase(slashForget[2] ?? "");
    const key = normalizeKey(raw);
    if (!key) return undefined;
    return { kind: "forget", key, rawKey: raw };
  }
  const forget = t.match(FORGET_RE);
  if (forget) {
    const rest = (forget[4] ?? "").trim();
    if (!rest) return { kind: "forget", key: "", rawKey: "" };
    const my = rest.match(/^(my\s+)?([a-z0-9 _.-]+)$/i);
    const raw = cleanKeyPhrase(my?.[2] ?? rest);
    return { kind: "forget", key: normalizeKey(raw), rawKey: raw };
  }
  if (!SAVE_TRIGGERS.test(t)) return undefined;
  const triggerIdx = t.search(SAVE_TRIGGERS);
  const payload = t.slice(triggerIdx).replace(/^(remember|note that|save this|keep in mind|don't forget|do not forget)\b\s*(that\s+)?/i, "");
  return parsePayload(payload);
}
