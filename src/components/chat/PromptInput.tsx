import { createSignal, Show } from "solid-js";
import { Bot, Cpu, Send, Sparkles, Square, Loader2 } from "lucide-solid";
import { strings } from "../../lib/i18n/en";
import { Button } from "../ui/Button";
import { AgentPicker } from "./AgentPicker";
import { ModelPicker } from "./ModelPicker";

interface PromptInputProps {
  sending: boolean;
  streaming?: boolean;
  onSend: (text: string) => void;
  onStop?: () => void;
}

/** Polished composer: labeled pills, auto-grow input, gradient send with micro-interactions. */
export function PromptInput(props: PromptInputProps) {
  const [text, setText] = createSignal("");
  const [focused, setFocused] = createSignal(false);
  const hasText = () => text().trim().length > 0;
  const canSend = () => hasText() && !props.sending;
  let taRef: HTMLTextAreaElement | undefined;

  function submit() {
    const value = text().trim();
    if (!value || props.sending) return;
    props.onSend(value);
    setText("");
    if (taRef) {
      taRef.style.height = "auto";
      taRef.focus();
    }
  }

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  return (
    <div style="padding:14px 16px 12px;background:linear-gradient(180deg, transparent 0%, var(--bg-subtle) 100%);border-top:1px solid var(--border)">
      <div
        style={`background:var(--surface);border:1.5px solid ${focused() ? "var(--rudra-orange)" : "var(--border)"};border-radius:20px;box-shadow:${focused() ? "0 0 0 3px rgba(255,77,28,0.12), var(--shadow-md)" : "var(--shadow-sm)"};transition:all var(--transition-base);overflow:hidden;transform:${focused() ? "translateY(-1px)" : "none"}`}
      >
        {/* Toolbar */}
        <div style="display:flex;align-items:center;gap:12px;padding:11px 14px 9px;border-bottom:1px solid var(--border);background:linear-gradient(180deg, var(--surface) 0%, var(--bg-subtle) 100%);flex-wrap:wrap">
          <span style="display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:800;letter-spacing:0.07em;text-transform:uppercase;color:var(--muted)">
            <span style="width:22px;height:22px;border-radius:7px;background:var(--rudra-gradient);display:inline-flex;align-items:center;justify-content:center;color:white;box-shadow:0 2px 8px rgba(255,77,28,0.25)">
              <Sparkles size={11} />
            </span>
            Compose
          </span>
          <span style="flex:1;min-width:12px" />
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;background:rgba(255,77,28,0.08);border:1px solid rgba(255,77,28,0.18);color:var(--rudra-orange);font-size:11px;font-weight:700">
              <Cpu size={12} />
              Model
            </span>
            <ModelPicker compact />
            <span style="width:1px;height:20px;background:var(--border);display:inline-block;margin:0 2px" />
            <span style="display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.18);color:#818cf8;font-size:11px;font-weight:700">
              <Bot size={12} />
              Agent
            </span>
            <AgentPicker compact />
          </div>
        </div>

        {/* Textarea */}
        <div style="padding:6px 14px 4px">
          <textarea
            ref={taRef}
            value={text()}
            onInput={(e) => {
              setText(e.currentTarget.value);
              autoGrow(e.currentTarget);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={strings.promptPlaceholder}
            rows={2}
            aria-label="Prompt input"
            style="width:100%;min-height:56px;max-height:160px;resize:none;background:transparent;color:var(--fg);border:none;outline:none;padding:10px 2px 6px;font-size:15px;line-height:1.65;font-family:Inter, system-ui, sans-serif;placeholder-color:var(--muted);transition:height var(--transition-fast)"
          />
        </div>

        {/* Footer */}
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px 12px;background:var(--surface);border-top:1px solid transparent">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--muted);font-weight:500">
              <kbd style="display:inline-flex;align-items:center;justify-content:center;min-width:26px;padding:4px 7px;border-radius:7px;background:var(--bg);border:1px solid var(--border);border-bottom-width:2px;font-size:10px;font-weight:800;letter-spacing:0.03em;color:var(--muted);font-family:inherit;box-shadow:var(--shadow-sm)">
                ↵
              </kbd>
              <span style="opacity:0.9">Ctrl + Enter to send</span>
            </span>
            <Show when={hasText()}>
              <span style="font-size:11px;color:var(--muted);opacity:0.7">{text().trim().length} chars</span>
            </Show>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <Show when={props.streaming && props.onStop}>
              <Button variant="danger" size="md" onClick={props.onStop} style="gap:7px;min-width:84px">
                <Square size={13} fill="currentColor" />
                {strings.stop}
              </Button>
            </Show>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!canSend()}
              onClick={(e) => {
                e.preventDefault();
                submit();
              }}
              style={`min-width:104px;gap:7px;position:relative;overflow:hidden;${canSend() ? "box-shadow:var(--shadow-glow)" : ""}`}
            >
              <Show when={props.sending} fallback={<Send size={15} style="transition:transform var(--transition-fast)" />}>
                <Loader2 size={15} style="animation:rudra-spin 0.8s linear infinite" />
              </Show>
              {props.sending ? strings.loading : strings.send}
            </Button>
          </div>
        </div>
      </div>
      <p style="margin:9px 2px 0;font-size:11px;color:var(--muted);text-align:center;opacity:0.75;letter-spacing:0.01em">
        RUDRA can make mistakes — review important code before shipping.
      </p>
    </div>
  );
}
