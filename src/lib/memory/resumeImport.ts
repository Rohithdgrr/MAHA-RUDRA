import type { JsonValue, MemoryCategory } from "./types";
import { normalizeKey, slugify } from "./store";

/**
 * Phase 6: bulk-import parsers. Pure heuristics — everything lands in a
 * preview list and nothing saves until the user confirms each entry.
 */
export interface ImportDraft {
  category: MemoryCategory;
  key: string;
  value: JsonValue;
  excerpt: string;
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;
const GITHUB_RE = /github\.com\/([A-Za-z0-9-]{1,39})/i;
const LINKEDIN_RE = /linkedin\.com\/in\/([A-Za-z0-9-]{1,100})/i;
const URL_RE = /https?:\/\/[^\s),]+/i;
const MAX_CHARS = 20000;

function draft(
  category: MemoryCategory,
  key: string,
  value: JsonValue,
  excerpt: string,
): ImportDraft | undefined {
  const k = normalizeKey(key);
  if (!k) return undefined;
  return { category, key: k, value, excerpt: excerpt.trim().slice(0, 140) };
}

/** Heuristic pass over pasted resume/CV/LinkedIn text. Capped at 12 drafts. */
export function parseResumeText(text: string): ImportDraft[] {
  const body = text.slice(0, MAX_CHARS);
  if (!body.trim()) return [];
  const lines = body.split(/\r?\n/);
  const out: ImportDraft[] = [];

  const email = body.match(EMAIL_RE)?.[0];
  if (email) {
    const line = lines.find((l) => l.includes(email)) ?? email;
    const d = draft("contact", "email", email, line);
    if (d) out.push(d);
  }
  const gh = body.match(GITHUB_RE)?.[1];
  if (gh) {
    const line = lines.find((l) => l.includes(gh)) ?? gh;
    const d = draft("social", "github", `@${gh}`, line);
    if (d) out.push(d);
  }
  const li = body.match(LINKEDIN_RE)?.[0];
  if (li) {
    const line = lines.find((l) => l.includes("linkedin.com")) ?? li;
    const d = draft("social", "linkedin", li.startsWith("http") ? li : `https://${li}`, line);
    if (d) out.push(d);
  }
  const site = body.match(URL_RE)?.[0];
  if (site && !site.includes("github.com") && !site.includes("linkedin.com")) {
    const d = draft("social", "site", site.replace(/[.,;]+$/, ""), site);
    if (d) out.push(d);
  }
  const phoneLine = lines.find((l) => PHONE_RE.test(l) && !/\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}/.test(l));
  const phone = phoneLine?.match(PHONE_RE)?.[1]?.trim();
  if (phone && phone.replace(/\D/g, "").length >= 7) {
    const d = draft("contact", "phone", phone, phoneLine ?? phone);
    if (d) out.push(d);
  }
  const first = lines.map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  if (
    first &&
    first.length <= 40 &&
    !first.includes("@") &&
    !first.includes("http") &&
    /^[A-Za-z][A-Za-z .'-]*$/.test(first) &&
    first.split(/\s+/).length <= 4
  ) {
    const d = draft("identity", "name", first, first);
    if (d) out.push(d);
  }
  const skillsIdx = lines.findIndex((l) => /^\s*skills?\s*[:|-]/i.test(l));
  if (skillsIdx >= 0) {
    const raw = (lines[skillsIdx] ?? "").replace(/^\s*skills?\s*[:|-]\s*/i, "");
    const skills = raw.split(/[,•|/]/).map((s) => s.trim()).filter((s) => s.length > 0).slice(0, 20);
    if (skills.length > 0) {
      const d = draft("cv", "skills", skills, lines[skillsIdx] ?? "");
      if (d) out.push(d);
    }
  }

  const seen = new Set<string>();
  return out
    .filter((d) => {
      const slot = `${d.category}::${d.key}`;
      if (seen.has(slot)) return false;
      seen.add(slot);
      return true;
    })
    .slice(0, 12);
}

interface GhProfile {
  login: string;
  name?: string;
  bio?: string;
  blog?: string;
  location?: string;
}

interface GhRepo {
  name: string;
  description?: string;
  language?: string;
  stargazers_count?: number;
  html_url?: string;
  fork?: boolean;
}

function asProfile(raw: unknown): GhProfile | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.login !== "string" || !r.login) return undefined;
  return {
    login: r.login,
    ...(typeof r.name === "string" ? { name: r.name } : {}),
    ...(typeof r.bio === "string" ? { bio: r.bio } : {}),
    ...(typeof r.blog === "string" ? { blog: r.blog } : {}),
    ...(typeof r.location === "string" ? { location: r.location } : {}),
  };
}

function asRepos(raw: unknown): GhRepo[] {
  if (!Array.isArray(raw)) return [];
  const out: GhRepo[] = [];
  for (const item of raw.slice(0, 30)) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    if (typeof r.name !== "string" || !r.name) continue;
    out.push({
      name: r.name,
      ...(typeof r.description === "string" ? { description: r.description } : {}),
      ...(typeof r.language === "string" ? { language: r.language } : {}),
      ...(typeof r.stargazers_count === "number" ? { stargazers_count: r.stargazers_count } : {}),
      ...(typeof r.html_url === "string" ? { html_url: r.html_url } : {}),
      ...(typeof r.fork === "boolean" ? { fork: r.fork } : {}),
    });
  }
  return out;
}

/** Map public GitHub data to import drafts. Invalid shapes yield []. */
export function githubToCandidates(profile: unknown, repos: unknown): ImportDraft[] {
  const p = asProfile(profile);
  if (!p) return [];
  const out: ImportDraft[] = [];
  const push = (d: ImportDraft | undefined) => {
    if (d) out.push(d);
  };
  push(draft("social", "github", `@${p.login}`, `github.com/${p.login}`));
  if (p.name?.trim()) push(draft("identity", "name", p.name.trim(), p.name));
  if (p.bio?.trim()) push(draft("cv", "summary", p.bio.trim().slice(0, 500), p.bio));
  if (p.location?.trim()) push(draft("identity", "location", p.location.trim(), p.location));
  if (p.blog?.trim()) push(draft("social", "site", p.blog.trim(), p.blog));
  const top = asRepos(repos)
    .sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0))
    .slice(0, 5);
  for (const r of top) {
    push(
      draft("projects", `project.${slugify(r.name)}`, {
        name: r.name,
        ...(r.description ? { desc: r.description.slice(0, 300) } : {}),
        ...(r.language ? { stack: [r.language] } : {}),
        status: "active",
        ...(r.html_url ? { links: [r.html_url] } : {}),
      }, `github.com/${p.login}/${r.name}`),
    );
  }
  return out.slice(0, 10);
}
