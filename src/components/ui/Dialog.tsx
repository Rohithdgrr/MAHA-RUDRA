import { Show, type JSX, onCleanup, onMount } from "solid-js";
import { X } from "lucide-solid";

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: JSX.Element;
  width?: string;
}

/** Centered modal with backdrop blur, scale-in and close button. Web-safe. */
export function Dialog(props: DialogProps) {
  let closeBtnRef: HTMLButtonElement | undefined;

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && props.open) props.onClose();
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  return (
    <Show when={props.open}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        class="rudra-fade-in"
        style="position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)"
        onClick={() => props.onClose()}
      >
        <div
          class="rudra-scale-in"
          style={`background:var(--surface);border:1px solid var(--border);border-radius:18px;box-shadow:var(--shadow-lg);width:${props.width ?? "min(92vw,480px)"};max-height:min(88vh,720px);overflow:hidden;display:flex;flex-direction:column`}
          onClick={(e) => e.stopPropagation()}
        >
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 20px 14px;border-bottom:1px solid var(--border);flex-shrink:0">
            <h2 style="margin:0;font-size:15px;font-weight:700;letter-spacing:-0.01em">{props.title}</h2>
            <button
              ref={closeBtnRef}
              type="button"
              aria-label="Close"
              onClick={() => props.onClose()}
              style="width:32px;height:32px;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--muted);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:all var(--transition-fast)"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-hover)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--fg)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--bg)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)";
              }}
            >
              <X size={16} />
            </button>
          </div>
          <div style="padding:20px;overflow-y:auto;flex:1" class="rudra-scroll">
            {props.children}
          </div>
        </div>
      </div>
    </Show>
  );
}
