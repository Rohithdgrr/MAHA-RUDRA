import { logger } from "./logger";

/**
 * Shiki code highlighting on the lightweight core path: JS regex engine
 * (no oniguruma wasm) and an explicit grammar list, so only ~20 small
 * chunks ship instead of the full grammar catalog. Loaded lazily off the
 * critical path; callers fall back to the sync regex tokenizer in
 * `highlight.ts` until ready. Sync `highlightWithShiki` never throws.
 */

const MAX_CHARS = 50000;

const LANG_MAP: Record<string, string> = {
  js: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  py: "python",
  python3: "python",
  sh: "bash",
  shell: "bash",
  console: "bash",
  zsh: "bash",
  yml: "yaml",
  golang: "go",
};

const BUNDLED = [
  "typescript",
  "javascript",
  "tsx",
  "jsx",
  "rust",
  "python",
  "bash",
  "json",
  "yaml",
  "toml",
  "go",
  "html",
  "css",
  "markdown",
  "diff",
  "dockerfile",
];

/** Map a fence language to a bundled Shiki grammar, or undefined to fall back. Pure. */
export function pickShikiLang(lang: string): string | undefined {
  const l = (lang || "").trim().toLowerCase();
  const mapped = LANG_MAP[l] ?? l;
  return BUNDLED.includes(mapped) ? mapped : undefined;
}

function pickTheme(): string {
  try {
    if (typeof document !== "undefined" && !document.documentElement.classList.contains("dark")) {
      return "github-light";
    }
  } catch {
    // ignore — default to dark
  }
  return "github-dark";
}

type Highlighter = {
  codeToHtml(code: string, options: { lang: string; theme: string }): string;
};

let highlighter: Highlighter | undefined;
let pending: Promise<void> | undefined;

type GrammarModule = { default: unknown };

// Explicit loader list so Vite code-splits exactly these grammars/themes.
const themeLoaders: Array<() => Promise<GrammarModule>> = [
  () => import("shiki/themes/github-dark.mjs"),
  () => import("shiki/themes/github-light.mjs"),
];

const langLoaders: Array<() => Promise<GrammarModule>> = [
  () => import("shiki/langs/typescript.mjs"),
  () => import("shiki/langs/javascript.mjs"),
  () => import("shiki/langs/tsx.mjs"),
  () => import("shiki/langs/jsx.mjs"),
  () => import("shiki/langs/rust.mjs"),
  () => import("shiki/langs/python.mjs"),
  () => import("shiki/langs/bash.mjs"),
  () => import("shiki/langs/json.mjs"),
  () => import("shiki/langs/yaml.mjs"),
  () => import("shiki/langs/toml.mjs"),
  () => import("shiki/langs/go.mjs"),
  () => import("shiki/langs/html.mjs"),
  () => import("shiki/langs/css.mjs"),
  () => import("shiki/langs/markdown.mjs"),
  () => import("shiki/langs/diff.mjs"),
  () => import("shiki/langs/dockerfile.mjs"),
];

/** Fire once at startup; resolves when grammars are ready (or logs and gives up). */
export function initShiki(): Promise<void> {
  if (highlighter) return Promise.resolve();
  if (pending) return pending;
  pending = (async () => {
    try {
      const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
        import("shiki/core"),
        import("shiki/engine/javascript"),
      ]);
      const [themes, langs] = await Promise.all([
        Promise.all(themeLoaders.map((load) => load())),
        Promise.all(langLoaders.map((load) => load())),
      ]);
      highlighter = (await createHighlighterCore({
        themes: themes.map((t) => t.default) as never[],
        langs: langs.map((l) => l.default) as never[],
        engine: createJavaScriptRegexEngine(),
      })) as unknown as Highlighter;
      logger.info("Shiki highlighter ready");
    } catch (err) {
      highlighter = undefined;
      logger.warn(`Shiki unavailable, using fallback highlighting: ${(err as Error).message}`);
    }
  })();
  return pending;
}

/** Shiki HTML for `code`, or undefined when unavailable (caller falls back). */
export function highlightWithShiki(code: string, lang: string): string | undefined {
  if (!highlighter || code.length > MAX_CHARS) return undefined;
  const grammar = pickShikiLang(lang);
  if (!grammar) return undefined;
  try {
    return highlighter.codeToHtml(code, { lang: grammar, theme: pickTheme() });
  } catch {
    return undefined;
  }
}
