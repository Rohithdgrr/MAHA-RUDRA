import { For, Show, createEffect, createSignal } from "solid-js";

export interface CommandAction {
  id: string;
  title: string;
  hint?: string;
  run: () => void | Promise<void>;
}

/** Case-insensitive substring filter over id + title. Pure, tested. */
export function filterActions(actions: CommandAction[], query: string): CommandAction[] {
  const q = query.trim().toLowerCase();
  if (!q) return actions;
  return actions.filter(
    (a) => a.title.toLowerCase().includes(q) || a.id.toLowerCase().includes(q),
  );
}

interface PaletteProps {
  open: boolean;
  actions: CommandAction[];
  onClose: () => void;
}

/** Fuzzy command palette: type to filter, ↑/↓ + Enter to run, Esc to close. */
export function CommandPalette(props: PaletteProps) {
  const [filter, setFilter] = createSignal("");
  const [index, setIndex] = createSignal(0);
  let inputRef: HTMLInputElement | undefined;

  const matches = () => filterActions(props.actions, filter());

  createEffect(() => {
    if (props.open) {
      setFilter("");
      setIndex(0);
      // Focus after the overlay mounts.
      setTimeout(() => inputRef?.focus(), 0);
    }
  });

  createEffect(() => {
    // Clamp the cursor when the match list shrinks.
    if (index() >= matches().length) setIndex(Math.max(0, matches().length - 1));
  });

  async function run(action: CommandAction | undefined) {
    if (!action) return;
    props.onClose();
    await action.run();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, matches().length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      void run(matches()[index()]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      props.onClose();
    }
  }

  return (
    <Show when={props.open}>
      <div
        role="dialog"
        aria-label="Command palette"
        style="position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:50;display:flex;justify-content:center;align-items:flex-start;padding-top:12vh"
        onClick={() => props.onClose()}
      >
        <div
          style="width:min(92vw,560px);background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={onKey}
        >
          <input
            ref={inputRef}
            value={filter()}
            onInput={(e) => {
              setFilter(e.currentTarget.value);
              setIndex(0);
            }}
            placeholder="Type a command…"
            aria-label="Command filter"
            style="width:100%;box-sizing:border-box;background:transparent;color:var(--fg);border:none;border-bottom:1px solid var(--border);padding:14px 16px;font-size:14px;font-family:inherit;outline:none"
          />
          <div style="max-height:320px;overflow-y:auto;padding:6px" class="rudra-scroll">
            <For each={matches()}>
              {(action, i) => (
                <button
                  type="button"
                  onClick={() => void run(action)}
                  onMouseMove={() => setIndex(i())}
                  style={`display:flex;width:100%;box-sizing:border-box;justify-content:space-between;align-items:center;gap:12px;padding:10px 12px;border:none;border-radius:8px;cursor:pointer;font-size:13px;background:${i() === index() ? "var(--border)" : "transparent"};color:var(--fg);text-align:left`}
                >
                  <span>{action.title}</span>
                  <Show when={action.hint}>
                    <small style="color:var(--muted)">{action.hint}</small>
                  </Show>
                </button>
              )}
            </For>
            <Show when={matches().length === 0}>
              <p style="color:var(--muted);font-size:13px;padding:10px 12px;margin:0">
                No matching commands.
              </p>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
