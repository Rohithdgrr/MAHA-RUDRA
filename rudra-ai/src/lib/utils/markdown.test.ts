import { describe, expect, it } from "vitest";
import { extractText, handleCodeCardClick, renderMarkdown, renderRichMarkdown } from "./markdown";

describe("markdown", () => {
  it("renders bold text to HTML", () => {
    const html = renderMarkdown("Hello **RUDRA**");
    expect(html).toContain("<strong>RUDRA</strong>");
  });

  it("renders fenced code blocks", () => {
    const html = renderMarkdown("```ts\nconst a = 1;\n```");
    expect(html).toContain("<code");
  });

    it("extracts text parts only", () => {
    expect(
      extractText([
        { type: "text", text: "hello" },
        { type: "reasoning", text: "skip me" },
        { type: "text", text: "world" },
      ]),
    ).toBe("hello\nworld");
  });

  it("strips scripts and event handlers from rendered HTML", () => {
    const html = renderMarkdown('Hello <script>alert("x")</script> <b onclick="evil()">world</b>');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onclick");
    expect(html).toContain("world");
  });

  it("renders code fences as cards with copy/diff/check actions", () => {
    const html = renderRichMarkdown("```rust\nlet x = 1;\n```");
    expect(html).toContain("code-card");
    expect(html).toContain("md-copy-btn");
    expect(html).toContain("md-diff-btn");
    expect(html).toContain("md-check-btn");
    // rust is aliased to rs in the card label
    expect(html).toContain(">rs<");
    expect(html).toContain("let");
  });

  it("handles card button clicks without throwing", () => {
    const holder = document.createElement("div");
    holder.innerHTML = renderRichMarkdown("```ts\nconst a = 1;\n```");
    document.body.appendChild(holder);
    try {
      for (const cls of ["md-copy-btn", "md-diff-btn", "md-check-btn"]) {
        const btn = holder.querySelector(`.${cls}`) as HTMLElement;
        expect(btn).toBeTruthy();
        const handled = handleCodeCardClick({ target: btn } as unknown as MouseEvent);
        expect(handled).toBe(true);
      }
    } finally {
      holder.remove();
    }
  });
});
