import type { MessageWithParts, Session } from "../backend/types";
import { extractText } from "./markdown";

function partText(parts: MessageWithParts["parts"]): string {
  const text = extractText(parts as Array<{ type: string; text?: string }>);
  if (text) return text;
  // Non-text turns (tools, files, steps): summarize so the export keeps its shape.
  return parts.map((p) => `[${p.type} part]`).join("\n");
}

/** Render a session transcript as Markdown. Pure, tested. */
export function sessionToMarkdown(
  session: Session | undefined,
  messages: MessageWithParts[],
): string {
  const title = session?.title?.trim() || "Untitled session";
  const lines: string[] = [`# ${title}`, ""];
  if (session) {
    lines.push(`- Session: \`${session.id}\``, `- Updated: ${new Date(session.time.updated).toLocaleString()}`, "");
  }
  for (const m of messages) {
    const role = m.info.role === "user" ? "You" : "RUDRA";
    lines.push(`## ${role}`, "", partText(m.parts), "");
  }
  return lines.join("\n");
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function sessionFilename(session: Session | undefined, id: string): string {
  const slug = (session?.title?.trim() || "session").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "session";
  return `rudra-${slug}-${id.slice(0, 8)}.md`;
}
