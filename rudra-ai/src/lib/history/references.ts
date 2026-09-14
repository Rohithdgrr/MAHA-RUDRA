/** Reference IDs (Phase 2, Layer 2.3/3.6): replay IDs, never content.
 *
 *  - Files: `src/api.ts@a3f9c1d2` (path + content hash). The injector resolves
 *    the current text only when the turn actually needs it.
 *  - Docs: `doc:<slug>-<hash>` issued by `DocRegistry`; later turns say
 *    `use doc:…` for a ~0-token cache hit.
 *  Session-scoped and bounded. Pure logic.
 */
import { hashString } from "../agent-tools/types";

export function fileRef(path: string, content: string): string {
  return `${path.replace(/\\/g, "/")}@${hashString(content)}`;
}

/** Parse `path@hash`. Returns undefined on malformed input (never throws). */
export function parseFileRef(ref: string): { path: string; hash: string } | undefined {
  const at = ref.lastIndexOf("@");
  if (at <= 0 || at >= ref.length - 1) return undefined;
  const path = ref.slice(0, at);
  const hash = ref.slice(at + 1);
  if (!path || !/^[a-z0-9]+$/i.test(hash)) return undefined;
  return { path, hash };
}

function slugify(text: string): string {
  const s = text
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || "doc";
}

const MAX_DOCS = 100;
const MAX_DOC_CHARS = 40_000;

export class DocRegistry {
  private docs = new Map<string, string>();

  /** Store markdown, get back a stable `doc_id`. Same text → same id. */
  register(source: string, markdown: string): string {
    const id = `doc:${slugify(source)}-${hashString(markdown)}`;
    if (!this.docs.has(id)) {
      this.docs.set(id, markdown.slice(0, MAX_DOC_CHARS));
      if (this.docs.size > MAX_DOCS) {
        const first = this.docs.keys().next().value;
        if (first) this.docs.delete(first);
      }
    }
    return id;
  }

  resolve(docId: string): string | undefined {
    return this.docs.get(docId);
  }

  has(docId: string): boolean {
    return this.docs.has(docId);
  }

  clear(): void {
    this.docs.clear();
  }
}
