/** fetch_docs: cached, cleaned documentation lookup with BM25-lite filtering. */
import { ToolError, estimateTokens, hashString, truncateToTokens } from "./types";

export interface FetchDocsInput {
  url: string;
  query?: string;
  max_tokens?: number;
  cache_ttl_s?: number;
}

export interface FetchDocsResult {
  markdown: string;
  fromCache: boolean;
  sourceAnchors: string[];
  tokensEstimate: number;
  /** Stable reference for later turns (`use doc:…` ≈ 0 tokens). Present only
   *  when the caller supplies a registry. */
  doc_id?: string;
}

/** Structural registry (see lib/history/references DocRegistry). Kept structural
 *  to avoid a module cycle. */
export interface DocRefRegistry {
  register(source: string, markdown: string): string;
}

export interface DocsCache {
  get(url: string): Promise<{ hash: string; markdown: string; at: number } | undefined>;
  set(url: string, entry: { hash: string; markdown: string; at: number }): Promise<void>;
}

export class MemoryDocsCache implements DocsCache {
  private m = new Map<string, { hash: string; markdown: string; at: number }>();
  async get(url: string): Promise<{ hash: string; markdown: string; at: number } | undefined> {
    return this.m.get(url);
  }
  async set(
    url: string,
    entry: { hash: string; markdown: string; at: number },
  ): Promise<void> {
    this.m.set(url, entry);
    if (this.m.size > 200) {
      const first = this.m.keys().next().value;
      if (first) this.m.delete(first);
    }
  }
}

export type FetchFn = (url: string) => Promise<{ status: number; text: string }>;

/** Strip scripts/styles/nav, convert basic HTML to markdown. Never throws. */
export function htmlToMarkdown(html: string): string {
  try {
    let s = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ");
    s = s
      .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, l: string, t: string) => `\n${"#".repeat(Number(l))} ${stripTags(t)}\n`)
      .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, t: string) => `\n\`\`\`\n${stripTags(t)}\n\`\`\`\n`)
      .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, t: string) => `\`${stripTags(t)}\``)
      .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, t: string) => `[${stripTags(t)}](${href})`)
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t: string) => `\n- ${stripTags(t)}`)
      .replace(/<(p|div|br|tr|section|article)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ");
    return s
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch {
    return html.slice(0, 8000);
  }
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export interface Chunk {
  heading: string;
  text: string;
}

/** Split markdown by headings into chunks. Pure. */
export function chunkMarkdown(md: string, maxChars = 2000): Chunk[] {
  const chunks: Chunk[] = [];
  const parts = md.split(/^(#{1,4}\s+.+)$/m);
  let heading = "top";
  let buf = "";
  const flush = () => {
    if (buf.trim()) {
      for (let i = 0; i < buf.length; i += maxChars) {
        chunks.push({ heading, text: buf.slice(i, i + maxChars) });
      }
    }
    buf = "";
  };
  for (const part of parts) {
    if (/^#{1,4}\s+/.test(part.trim())) {
      flush();
      heading = part.trim().slice(0, 120);
    } else {
      buf += part;
    }
  }
  flush();
  return chunks.slice(0, 200);
}

function tokenize(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
}

/** BM25-lite scoring (tf * idf approx). Pure. */
export function scoreChunks(chunks: Chunk[], query: string): Chunk[] {
  const q = tokenize(query);
  if (q.length === 0) return chunks;
  const df = new Map<string, number>();
  const tfs: Array<Map<string, number>> = chunks.map((c) => {
    const tf = new Map<string, number>();
    for (const t of tokenize(`${c.heading} ${c.text}`)) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of new Set(tf.keys())) df.set(t, (df.get(t) ?? 0) + 1);
    return tf;
  });
  const n = chunks.length;
  const scored = chunks.map((c, i) => {
    let s = 0;
    const tf = tfs[i];
    if (!tf) return { c, s: 0 };
    for (const t of q) {
      const f = tf.get(t) ?? 0;
      if (!f) continue;
      const idf = Math.log(1 + n / ((df.get(t) ?? 1) + 0.5));
      s += ((f * 2.2) / (f + 1.2)) * idf * (c.heading.toLowerCase().includes(t) ? 1.5 : 1);
    }
    return { c, s };
  });
  return scored
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c);
}

export async function fetchDocs(
  fetchFn: FetchFn,
  cache: DocsCache,
  input: FetchDocsInput,
  registry?: DocRefRegistry,
): Promise<FetchDocsResult> {
  if (!input.url || !/^https?:\/\//i.test(input.url.trim()))
    throw new ToolError("BAD_INPUT", "url must be an http(s) URL");
  const maxTokens = input.max_tokens ?? 4000;
  if (!Number.isFinite(maxTokens) || maxTokens <= 0 || maxTokens > 32000)
    throw new ToolError("BAD_INPUT", "max_tokens must be 1..32000");
  const ttlMs = (input.cache_ttl_s ?? 86400) * 1000;

  let raw: string;
  try {
    const res = await fetchFn(input.url);
    if (res.status < 200 || res.status >= 300)
      throw new ToolError("EXEC_FAILED", `docs fetch failed with status ${res.status}`);
    raw = res.text;
  } catch (e) {
    if (e instanceof ToolError) throw e;
    throw new ToolError("EXEC_FAILED", `docs fetch failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!raw.trim()) throw new ToolError("EXEC_FAILED", "docs page was empty");

  const contentHash = hashString(raw);
  const cached = await cache.get(input.url).catch(() => undefined);
  let markdown: string;
  let fromCache = false;
  if (cached && cached.hash === contentHash && Date.now() - cached.at < ttlMs) {
    markdown = cached.markdown;
    fromCache = true;
  } else {
    markdown = raw.trim().startsWith("<") ? htmlToMarkdown(raw) : raw.trim();
    if (!markdown.trim()) markdown = raw.slice(0, 8000); // fallback: raw slice
    await cache.set(input.url, { hash: contentHash, markdown, at: Date.now() }).catch(() => undefined);
  }
  let out = markdown;
  if (input.query?.trim()) {
    const chunks = chunkMarkdown(markdown);
    const ranked = scoreChunks(chunks, input.query);
    const picked = (ranked.length ? ranked : chunks).slice(0, 8);
    out = picked.map((c) => `### ${c.heading}\n\n${c.text}`).join("\n\n");
    if (!out.trim()) out = markdown;
  }
  out = truncateToTokens(out, maxTokens);
  const anchors = [...out.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].slice(0, 20).map((m) => m[2] ?? "");
  let doc_id: string | undefined;
  if (registry) {
    try {
      doc_id = registry.register(input.url, markdown);
    } catch {
      doc_id = undefined;
    }
  }
  return { markdown: out, fromCache, sourceAnchors: anchors, tokensEstimate: estimateTokens(out), ...(doc_id ? { doc_id } : {}) };
}
