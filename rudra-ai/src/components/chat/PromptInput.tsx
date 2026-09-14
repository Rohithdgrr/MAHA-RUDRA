import { createSignal, For, Show } from "solid-js";
import { ArrowUp, FileCode, Loader2, Paperclip, Square, X } from "lucide-solid";
import { strings } from "../../lib/i18n/en";
import { estimateTokens } from "../../lib/utils/tokens";
import { ModelPicker } from "./ModelPicker";

interface PromptInputProps {
  sending: boolean;
  streaming?: boolean;
  onSend: (text: string) => void;
  onStop?: () => void;
}

interface Attachment {
  name: string;
  size: number;
}

/** Mockup composer: prompt on top, Upload + model pill + token estimate + orange Send. */
export function PromptInput(props: PromptInputProps) {
  const [text, setText] = createSignal("");
  const [focused, setFocused] = createSignal(false);
  const [attachments, setAttachments] = createSignal<Attachment[]>([]);
  const hasText = () => text().trim().length > 0;
  const canSend = () => hasText() && !props.sending;
  let taRef: HTMLTextAreaElement | undefined;
  let fileRef: HTMLInputElement | undefined;

  function submit() {
    const value = text().trim();
    if (!value || props.sending) return;
    const files = attachments();
    const full =
      files.length > 0
        ? `${value}\n\n[attached files: ${files.map((f) => f.name).join(", ")}]`
        : value;
    props.onSend(full);
    setText("");
    setAttachments([]);
    if (taRef) {
      taRef.style.height = "auto";
      taRef.focus();
    }
  }

  function onFiles(files: FileList | null) {
    if (!files) return;
    const next = Array.from(files).map((f) => ({ name: f.name, size: f.size }));
    setAttachments((prev) => [...prev, ...next].slice(0, 5));
    if (fileRef) fileRef.value = "";
  }

  function removeAttachment(name: string) {
    setAttachments((prev) => prev.filter((a) => a.name !== name));
  }

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  return (
    <div class="composer-wrap">
      <div
        class="composer"
        style={focused() ? "border-color:var(--rudra-orange)" : undefined}
      >
        <div style="padding:4px 4px 0">
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
            placeholder="Ask RUDRA anything, run /actions, or drop code files…"
            rows={2}
            aria-label="Prompt input"
            class="composer-textarea"
          />
        </div>

        <Show when={attachments().length > 0}>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:0 16px 6px">
            <For each={attachments()}>
              {(a) => (
                <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 6px 4px 9px;border-radius:9px;background:var(--bg);border:1px solid var(--border);font-size:11px;font-weight:600;color:var(--fg);max-width:200px">
                  <FileCode size={12} style="color:var(--rudra-orange);flex-shrink:0" />
                  <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{a.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.name)}
                    title={strings.removeAttachment}
                    aria-label={`${strings.removeAttachment}: ${a.name}`}
                    style="width:18px;height:18px;border-radius:6px;border:none;background:transparent;color:var(--muted);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0"
                  >
                    <X size={11} />
                  </button>
                </span>
              )}
            </For>
          </div>
        </Show>

        <div class="composer-bar">
          <input
            ref={fileRef}
            type="file"
            multiple
            aria-label={strings.attachFiles}
            style="display:none"
            onChange={(e) => onFiles(e.currentTarget.files)}
          />
          <button type="button" class="upload-pill" title={strings.attachFiles} onClick={() => fileRef?.click()}>
            <Paperclip size={13} style="color:#cf3a12" />
            Upload
          </button>

          <ModelPicker compact />

          <span style="flex:1;min-width:4px" />

          <Show when={hasText()} fallback={<span style="font-size:11px;color:var(--muted);font-family:ui-monospace,monospace;white-space:nowrap">~48 tokens</span>}>
            <span style="font-size:11px;color:var(--muted);font-family:ui-monospace,monospace;white-space:nowrap">
              ~{estimateTokens(text())} tokens
            </span>
          </Show>

          <Show when={props.streaming && props.onStop}>
            <button
              type="button"
              onClick={props.onStop}
              title={strings.stop}
              style="width:36px;height:36px;border-radius:10px;border:1px solid rgba(248,81,73,0.3);background:rgba(248,81,73,0.12);color:var(--danger);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0"
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
              class="send-btn"
            >
              <Show when={props.sending} fallback={<>Send <ArrowUp size={14} strokeWidth={2.5} /></>}>
                <Loader2 size={14} style="animation:rudra-spin 0.8s linear infinite" />
              </Show>
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}
