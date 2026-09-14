import { describe, expect, it } from "vitest";
import { extractText, renderMarkdown } from "./markdown";

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
});
