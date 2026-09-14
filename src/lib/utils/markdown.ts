import DOMPurify from "dompurify";
import { marked } from "marked";
import { uiStore } from "../stores/ui.store";
import { strings } from "../i18n/en";
import { escapeHtml, highlightToHtml, normalizeLang } from "./highlight";

marked.setOptions({ breaks: true, gfm: true });

/** Card chrome injected around highlighted code (body is escaped above). */
function codeCardHtml(code: string, lang: string): string {
  const language = normalizeLang(lang);
  const body = highlightToHtml(code, language);
  const label = language || "code";
  return (
    `<div class="code-card"><div class="code-head">` +
    `<span class="code-glyph">&lt;&gt;</span>` +
    `<span class="code-lang">${escapeHtml(label)}</span>` +
    `<span class="code-actions">` +
    `<button type="button" class="md-diff-btn">Diff</button>` +
    `<button type="button" class="md-check-btn">Check</button>` +
    `<button type="button" class="md-copy-btn" data-code="${escapeHtml(code)}">Copy</button>` +
    `</span></div><div class="code-body">${body}</div></div>`
  );
}

/** Render Markdown to sanitized HTML (scripts, event handlers stripped). */
export function renderMarkdown(source: string): string {
  const raw = marked.parse(source, { async: false }) as string;
  return DOMPurify.sanitize(raw, { ADD_ATTR: ["data-code"] });
}

/** Render assistant markdown: code fences become interactive code cards. */
export function renderRichMarkdown(source: string): string {
  const html = renderMarkdown(source);
  const holder = document.createElement("div");
  holder.innerHTML = html;
  for (const pre of Array.from(holder.querySelectorAll("pre"))) {
    const codeEl = pre.querySelector("code");
    const text = (codeEl ?? pre).textContent ?? "";
    const langMatch = /language-([\w-]+)/.exec(codeEl?.className ?? "");
    const card = document.createElement("div");
    card.innerHTML = codeCardHtml(text, langMatch?.[1] ?? "");
    pre.replaceWith(card.firstElementChild ?? pre);
  }
  return holder.innerHTML;
}

/** Delegate clicks on injected card buttons (copy/diff/check); true when handled. */
export function handleCodeCardClick(e: MouseEvent): boolean {
  const el = e.target as HTMLElement;
  const diff = el.closest?.(".md-diff-btn") as HTMLElement | null;
  if (diff) {
    uiStore.toast(strings.diffViewSoon, "info");
    return true;
  }
  const check = el.closest?.(".md-check-btn") as HTMLElement | null;
  if (check) {
    uiStore.toast(strings.codeCheckSoon, "info");
    return true;
  }
  return handleCopyClick(e);
}

/** Delegate clicks on injected copy buttons; returns true when handled. */
export function handleCopyClick(e: MouseEvent): boolean {
  const btn = (e.target as HTMLElement).closest?.(".md-copy-btn") as HTMLElement | null;
  if (!btn) return false;
  const raw = btn.getAttribute("data-code") ?? "";
  const decoded = raw
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
  void navigator.clipboard?.writeText(decoded).then(() => {
    btn.classList.add("done");
    btn.textContent = "Copied";
    setTimeout(() => {
      btn.classList.remove("done");
      btn.textContent = "Copy";
    }, 1400);
  });
  return true;
}

export function extractText(parts: Array<{ type: string; text?: string }>): string {
  return parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("\n");
}
