/**
 * Minimal regex tokenizer for code cards. Zero dependencies, synchronous,
 * safe (callers escape every token before injecting into HTML).
 * Good enough for editorial highlighting — not a full grammar.
 */

export interface Token {
  text: string;
  /** CSS class from globals.css (syn-k, syn-s, …). Undefined = plain. */
  cls?: string;
}

const KEYWORDS = new Set(
  ("const let var function return if else for while do class extends new import from export default " +
    "async await try catch finally throw switch case break continue typeof instanceof interface type " +
    "enum implements public private protected static void struct impl fn pub use mod match loop in as " +
    "with def elif lambda pass raise yield package func defer chan go select map range defer end then " +
    "begin nil null undefined true false None NaN this self super and or not is namespace using enum")
    .split(" "),
);

const LITERALS = new Set(["true", "false", "null", "undefined", "None", "nil", "NaN"]);

const HASH_COMMENT = new Set([
  "py", "python", "sh", "bash", "zsh", "shell", "console", "yaml", "yml",
  "rb", "ruby", "r", "toml", "ini", "conf", "dockerfile", "makefile", "gitignore",
]);

const LANG_ALIASES: Record<string, string> = {
  javascript: "js", jsx: "js", typescript: "ts", tsx: "ts", python3: "py",
  golang: "go", rust: "rs", csharp: "cs", kotlin: "kt", yml: "yaml",
};

export function normalizeLang(lang: string): string {
  const l = (lang || "").trim().toLowerCase();
  return LANG_ALIASES[l] ?? l;
}

/** Tokenize `code` for `lang` into a flat token list (newlines kept in text). */
export function tokenize(code: string, lang: string): Token[] {
  const language = normalizeLang(lang);
  const isHash = HASH_COMMENT.has(language);
  const isJson = language === "json";
  const isBash = language === "sh" || language === "bash" || language === "zsh" || language === "shell" || language === "console";

  const comment = isHash ? "#[^\\n]*" : "\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/";
  const string = "\"(?:\\\\.|[^\"\\\\\\n])*\"?|'(?:\\\\.|[^'\\\\\\n])*'?|`(?:\\\\.|[^`\\\\])*`?";
  const number = "\\b0x[0-9a-fA-F]+\\b|\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b";
  const bashVar = isBash ? "\\$[\\w{}]+" : "";
  const master = new RegExp(`(${comment})|(${string})|(${number})|(${bashVar || "\\b\\B"})|([A-Za-z_$][\\w$]*)`, "g");

  const tokens: Token[] = [];
  let last = 0;
  for (let m = master.exec(code); m !== null; m = master.exec(code)) {
    if (m.index > last) tokens.push({ text: code.slice(last, m.index) });
    const [raw, cm, str, num, bvar, ident] = m;
    if (cm) tokens.push({ text: raw, cls: "syn-c" });
    else if (str) {
      // JSON: a string followed by `:` is a key.
      let key = false;
      if (isJson) {
        const rest = code.slice(m.index + raw.length);
        key = /^\s*:/.test(rest);
      }
      tokens.push({ text: raw, cls: key ? "syn-n" : "syn-s" });
    } else if (num) tokens.push({ text: raw, cls: "syn-n" });
    else if (bvar) tokens.push({ text: raw, cls: "syn-n" });
    else if (ident) {
      const lower = raw.toLowerCase();
      if (KEYWORDS.has(raw) || KEYWORDS.has(lower)) tokens.push({ text: raw, cls: "syn-k" });
      else if (LITERALS.has(raw)) tokens.push({ text: raw, cls: "syn-t" });
      else {
        // Function call or type-ish capitalised identifier.
        const rest = code.slice(m.index + raw.length);
        if (/^\s*\(/.test(rest)) tokens.push({ text: raw, cls: "syn-f" });
        else if (/^[A-Z]/.test(raw)) tokens.push({ text: raw, cls: "syn-t" });
        else tokens.push({ text: raw });
      }
    }
    last = m.index + raw.length;
  }
  if (last < code.length) tokens.push({ text: code.slice(last) });
  return tokens;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Split a flat token stream into per-line token lists (newlines removed). */
export function tokenizeLines(code: string, lang: string): Token[][] {
  const lines: Token[][] = [[]];
  for (const t of tokenize(code, lang)) {
    const pieces = t.text.split("\n");
    pieces.forEach((piece, i) => {
      if (i > 0) lines.push([]);
      if (piece.length > 0) lines[lines.length - 1]!.push({ text: piece, cls: t.cls });
    });
  }
  return lines;
}

/** Render code to code-card body HTML: numbered lines + syn-* spans (all escaped). */
export function highlightToHtml(code: string, lang: string): string {
  const lines = tokenizeLines(code.replace(/\n$/, ""), lang);
  return lines
    .map((toks, i) => {
      const spans = toks
        .map((t) => (t.cls ? `<span class="${t.cls}">${escapeHtml(t.text)}</span>` : escapeHtml(t.text)))
        .join("");
      return `<div class="code-line"><span class="code-ln">${String(i + 1).padStart(2, "0")}</span><code class="code-tx">${spans}</code></div>`;
    })
    .join("");
}

export { escapeHtml };
