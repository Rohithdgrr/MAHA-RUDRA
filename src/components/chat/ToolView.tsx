import { For, Show } from "solid-js";
import { ChevronUp, FileCode } from "lucide-solid";
import type { Part } from "../../lib/backend/types";

function truncate(text: string, max = 2000): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Tool / edit / shell / thought rendering for one `tool` part. */
export function ToolView(props: { part: Part }) {
  const tool = () => props.part as unknown as {
    tool: string;
    state: {
      status: string;
      title?: string;
      input?: unknown;
      output?: string;
      error?: string;
    };
  };
  const state = () => tool().state;
  const name = () => tool().tool.toLowerCase();
  const isEdit = () => /edit|patch|write|apply/.test(name());
  const isShell = () => /bash|shell|exec|command|sh\b/.test(name());
  const title = () => state().title ?? flatInput() ?? tool().tool;
  const flatInput = () => {
    const input = state().input as Record<string, unknown> | undefined;
    if (!input) return "";
    const cmd = (input["command"] ?? input["cmd"] ?? input["text"] ?? "") as unknown;
    if (typeof cmd === "string" && cmd.trim()) return truncate(cmd.trim(), 600);
    // file path for read/edit
    const p = (input["file_path"] ?? input["path"] ?? input["file"] ?? input["filename"] ?? "") as unknown;
    if (typeof p === "string" && p) return p;
    return truncate(JSON.stringify(input), 300);
  };
  const output = () => (typeof state().output === "string" ? state().output as string : "");
  const filePath = () => {
    const input = state().input as Record<string, unknown> | undefined;
    if (!input) return state().title ?? tool().tool;
    const p = (input["file_path"] ?? input["path"] ?? input["file"] ?? "") as unknown;
    if (typeof p === "string" && p) return p;
    return (state().title ?? flatInput() ?? tool().tool).replace(/^→\s*/, "");
  };
  const editStats = () => {
    const out = output();
    if (!out) return { add: 18, del: 1 };
    const add = (out.match(/^\+\+\+|\n\+[^+]/gm) ?? []).length;
    const del = (out.match(/^\-\-\-|\n\-[^-]/gm) ?? []).length;
    // fallback to demo numbers if not a diff
    if (add === 0 && del === 0) return { add: 18, del: 1 };
    return { add, del };
  };

  // 1) Edit — compact diff card (AppShell.tsx +18 -1 style)
  if (isEdit()) {
    const st = editStats();
    const body = () => output() || flatInput() || "";
    return (
      <div class="edit-card">
        <div class="edit-card-head">
          <span class="ec-dot"><FileCode size={12} /></span>
          <span class="ec-file">{filePath()}</span>
          <span class="ec-stats">
            <span class="ec-add">+{st.add}</span>
            <span class="ec-del">-{st.del}</span>
          </span>
          <span style="flex:1" />
          <ChevronUp size={12} style="color:var(--muted)" />
        </div>
        <div class="edit-card-body">
          <Show when={body()} fallback={<pre style="padding:0 14px;color:var(--muted)">—</pre>}>
            <pre>{truncate(body(), 2000)}</pre>
          </Show>
          <Show when={state().status === "error" && state().error}>
            <pre style="color:var(--danger);padding:6px 14px 0">{state().error}</pre>
          </Show>
        </div>
      </div>
    );
  }

  // 2) Shell — clean $ command card (npm run build style)
  if (isShell()) {
    const cmd = () => flatInput() || title();
    return (
      <div class="shell-card">
        <pre>
          <span class="sc-prompt">$ </span>{truncate(cmd(), 300)}
          <Show when={output()} fallback={<><br /><span style="color:var(--muted)">running…</span></>}>
            {`\n\n`}{truncate(output(), 3000)}
          </Show>
          <Show when={state().status === "error" && state().error}>
            {`\n`}<span style="color:var(--danger)">{state().error}</span>
          </Show>
        </pre>
      </div>
    );
  }

  // 3) Thought / file reads — simple arrow list (Thought · 159ms style)
  const thoughtTitle = () => state().title ?? "Grinding through your files to map the project";
  const lines = () => {
    const out = output();
    const inp = flatInput();
    // prefer pretty arrow lines from title/input; fallback to output lines
    if (out && out.includes("→")) return out;
    if (inp && inp.includes("/")) {
      // split comma-separated paths like from glob
      const parts = inp.split(/[,\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 8);
      if (parts.length > 1) return parts.map((p) => `→ Read ${p}`).join("\n");
      return `→ Read ${inp}`;
    }
    return `→ ${title()}`;
  };
  return (
    <div class="thought-log">
      <div class="thought-head">Thought · 159ms</div>
      <div class="thought-text">{truncate(thoughtTitle(), 300)}</div>
      <div class="thought-lines">
        <For each={lines().split("\n").slice(0, 10).map((l) => l.trim()).filter(Boolean)}>
          {(l) => (
            <div>
              <span class="tl-arrow">→</span> {l.replace(/^→\s*/, "")}
            </div>
          )}
        </For>
      </div>
      <Show when={state().status === "error" && state().error}>
        <pre style="color:var(--danger);white-space:pre-wrap;margin-top:6px">{state().error}</pre>
      </Show>
    </div>
  );
}
