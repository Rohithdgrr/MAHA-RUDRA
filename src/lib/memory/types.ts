/** Memory domain types (Phase 1: manual CRUD foundation). */

export type MemoryCategory =
  | "identity"
  | "contact"
  | "social"
  | "preferences"
  | "projects"
  | "achievements"
  | "resume"
  | "cv"
  | "custom";

export type MemoryStatus = "active" | "pending" | "rejected" | "archived";

export type JsonValue = string | number | boolean | null | string[] | Record<string, unknown>;

export interface MemorySource {
  sessionId: string;
  messageId: string;
  excerpt: string;
  timestamp: number;
}

export interface Memory {
  id: string;
  category: MemoryCategory;
  key: string;
  value: JsonValue;
  confidence: number;
  status: MemoryStatus;
  sensitive: boolean;
  source: MemorySource;
  createdAt: number;
  updatedAt: number;
  lastConfirmedAt: number;
  supersedes?: string;
}

export const MEMORY_CATEGORIES: MemoryCategory[] = [
  "identity",
  "contact",
  "social",
  "preferences",
  "projects",
  "achievements",
  "resume",
  "cv",
  "custom",
];

export const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  identity: "Identity",
  contact: "Contact",
  social: "Social & profiles",
  preferences: "Preferences",
  projects: "Projects",
  achievements: "Achievements",
  resume: "Resume",
  cv: "CV",
  custom: "Custom",
};

/** Categories excluded from prompt injection unless the user opts in. */
export const SENSITIVE_CATEGORIES: MemoryCategory[] = ["contact"];

export function isMemoryCategory(v: unknown): v is MemoryCategory {
  return typeof v === "string" && (MEMORY_CATEGORIES as string[]).includes(v);
}

export function isMemoryStatus(v: unknown): v is MemoryStatus {
  return v === "active" || v === "pending" || v === "rejected" || v === "archived";
}

export function createMemoryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `mem_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export function formatMemoryValue(value: JsonValue): string {
  if (value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.join(", ");
  const rec = value as Record<string, unknown>;
  const name = typeof rec.name === "string" ? rec.name : undefined;
  const desc = typeof rec.desc === "string" ? rec.desc : undefined;
  const title = typeof rec.title === "string" ? rec.title : undefined;
  const head = name ?? title ?? "";
  if (head && desc) return `${head} — ${desc}`;
  if (head) return head;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
