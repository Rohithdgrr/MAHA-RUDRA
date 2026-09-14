import { createSignal, For, Show, onCleanup, onMount } from "solid-js";
import { ArrowUp, ChevronDown, Paperclip, Square, Loader2 } from "lucide-solid";
import { strings } from "../../lib/i18n/en";
import { uiStore, type EffortLevel } from "../../lib/stores/ui.store";
import { AgentPicker } from "./AgentPicker";
import { ModelPicker } from "./ModelPicker";

interface PromptInputProps {
  sending: boolean;
  streaming?: boolean;
  onSend: (text: string) => void;
  onStop?: () => void;
}

/** Clean composer: textarea on top, bottom toolbar with +/agent/model/effort/send. */
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
    <div style="padding:10px 16px 6px">
      <div
        style={`background:var(--surface);border:1.5px solid ${focused() ? "var(--rudra-orange)" : "var(--border)"};border-radius:20px;box-shadow:${focused() ? "0 0 0 3px rgba(255,77,28,0.12), var(--shadow-md)" : "var(--shadow-sm)"};transition:all var(--transition-base);overflow:hidden;transform:${focused() ? "translateY(-1px)" : "none"}`}
      >
        {/* Textarea — top area */}
        <div style="padding:12px 16px 4px">
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
            placeholder="Ask anything, / for commands, @ for context..."
            rows={2}
            aria-label="Prompt input"
            style="width:100%;min-height:48px;max-height:160px;resize:none;background:transparent;color:var(--fg);border:none;outline:none;padding:4px 2px 6px;font-size:15px;line-height:1.6;font-family:Inter, system-ui, sans-serif;placeholder-color:var(--muted);transition:height var(--transition-fast)"
          />
        </div>

        {/* Bottom toolbar */}
        <div style="display:flex;align-items:center;gap:6px;padding:6px 8px 8px;border-top:1px solid transparent">
          {/* + button (attachments) */}
          <button
            type="button"
            title="Attach file"
            style="width:32px;height:32px;border-radius:10px;border:none;background:transparent;color:var(--muted);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all var(--transition-fast)"
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.background = "var(--surface-hover)";
              el.style.color = "var(--fg)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.background = "transparent";
              el.style.color = "var(--muted)";
            }}
          >
            <Paperclip size={16} />
          </button>

          {/* Agent picker — "Build" style */}
          <AgentPicker compact />

          {/* Separator */}
          <span style="width:1px;height:20px;background:var(--border);display:inline-block;flex-shrink:0" />

          {/* Model picker — chip style */}
          <ModelPicker compact />

          {/* Separator */}
          <span style="width:1px;height:20px;background:var(--border);display:inline-block;flex-shrink:0" />

          {/* Effort dropdown */}
          <EffortDropdown />

          {/* Spacer */}
          <span style="flex:1;min-width:4px" />

          {/* Send / Stop button */}
          <Show when={props.streaming && props.onStop}>
            <button
              type="button"
              onClick={props.onStop}
              title={strings.stop}
              style="width:34px;height:34px;border-radius:50%;border:1px solid rgba(248,81,73,0.3);background:rgba(248,81,73,0.12);color:var(--danger);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all var(--transition-fast)"
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = "rgba(248,81,73,0.2)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = "rgba(248,81,73,0.12)";
              }}
            >
              <Square size={14} fill="currentColor" />
            </button>
          </Show>
          <Show when={!props.streaming}>
            <button
              type="submit"
              onClick={(e) => {
                e.preventDefault();
                submit();
              }}
              disabled={!canSend()}
              title={canSend() ? strings.send : "Type a message to send"}
              style={`width:34px;height:34px;border-radius:50%;border:none;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all var(--transition-fast);${canSend() ? "background:var(--surface-hover);color:var(--fg);box-shadow:var(--shadow-sm)" : "background:transparent;color:var(--muted);cursor:not-allowed;opacity:0.5"}`}
              onMouseEnter={(e) => {
                if (!canSend()) return;
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = "var(--surface-active)";
                el.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                if (!canSend()) return;
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = "var(--surface-hover)";
                el.style.transform = "none";
              }}
            >
              <Show when={props.sending} fallback={<ArrowUp size={16} strokeWidth={2.5} />}>
                <Loader2 size={16} style="animation:rudra-spin 0.8s linear infinite" />
              </Show>
            </button>
          </Show>
        </div>
      </div>
      <p style="margin:7px 2px 0;font-size:10px;color:var(--muted);text-align:center;opacity:0.6;letter-spacing:0.01em">
        RUDRA can make mistakes — review important code before shipping.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Effort / priority dropdown (Low / Medium / High)
// ---------------------------------------------------------------------------

const effortLevels: EffortLevel[] = ["Low", "Medium", "High"];

function EffortDropdown() {
  const [open, setOpen] = createSignal(false);
  const selected = () => uiStore.state.prefs.effort;
  let containerRef: HTMLDivElement | undefined;

  function pick(level: EffortLevel) {
    uiStore.setPrefs({ effort: level });
    setOpen(false);
  }

  function handleClickOutside(e: MouseEvent) {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      setOpen(false);
    }
  }

  onMount(() => document.addEventListener("mousedown", handleClickOutside));
  onCleanup(() => document.removeEventListener("mousedown", handleClickOutside));

  return (
    <div ref={containerRef} style="position:relative;display:inline-flex;align-items:center">
      <button
        type="button"
        onClick={() => setOpen(!open())}
        style="display:inline-flex;align-items:center;gap:4px;padding:5px 9px;border-radius:999px;border:1px solid var(--border);background:var(--surface);color:var(--fg);font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;transition:all var(--transition-fast);white-space:nowrap"
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.borderColor = "var(--border-hover)";
          el.style.background = "var(--surface-hover)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.borderColor = "var(--border)";
          el.style.background = "var(--surface)";
        }}
      >
        {selected()}
        <ChevronDown size={12} style={`transition:transform var(--transition-fast);${open() ? "transform:rotate(180deg)" : ""}`} />
      </button>
      <Show when={open()}>
        <div
          style="position:absolute;top:calc(100% + 6px);left:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);box-shadow:var(--shadow-lg);padding:4px;min-width:100px;z-index:100;animation:rudra-scaleIn 0.15s ease-out"
        >
          <For each={effortLevels}>
            {(level) => (
              <button
                type="button"
                onClick={() => pick(level)}
                style={`width:100%;display:block;text-align:left;padding:7px 10px;border:none;border-radius:6px;background:${selected() === level ? "rgba(255,77,28,0.1)" : "transparent"};color:${selected() === level ? "var(--rudra-orange)" : "var(--fg)"};font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;transition:background var(--transition-fast)`}
                onMouseEnter={(e) => {
                  if (selected() !== level) (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-hover)";
                }}
                onMouseLeave={(e) => {
                  if (selected() !== level) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                {level}
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}


