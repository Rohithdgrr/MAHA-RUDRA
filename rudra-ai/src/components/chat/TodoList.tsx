import { createQuery } from "@tanstack/solid-query";
import { For, Show, createSignal } from "solid-js";
import { Check, ChevronDown, Circle, ListTodo, X, Loader2 } from "lucide-solid";
import type { Todo } from "@opencode-ai/sdk/client";
import { adapter } from "../../lib/backend";
import { todoStore } from "../../lib/stores/todo.store";

function statusIcon(status: string) {
  switch (status) {
    case "completed":
      return Check;
    case "in_progress":
      return Loader2;
    case "cancelled":
      return X;
    default:
      return Circle;
  }
}

function statusClass(status: string): string {
  switch (status) {
    case "completed":
      return "todo-icon done";
    case "in_progress":
      return "todo-icon progress";
    case "cancelled":
      return "todo-icon cancelled";
    default:
      return "todo-icon pending";
  }
}

function priorityClass(p: string): string {
  if (p === "high") return "todo-prio high";
  if (p === "low") return "todo-prio low";
  return "todo-prio medium";
}

const DEMO_TODOS: Todo[] = [
  { id: "1", content: "Map the codebase and read vision doc", status: "completed", priority: "high" },
  { id: "2", content: "Update TopBar to show full folder path", status: "completed", priority: "high" },
  { id: "3", content: "Merge snackbars into bottom status bar marquee", status: "in_progress", priority: "medium" },
  { id: "4", content: "Simplify tool cards for edit / shell", status: "pending", priority: "medium" },
  { id: "5", content: "Verify dark / light theme parity", status: "pending", priority: "low" },
];

/** Collapsible todo panel — opencode desktop style, rendered just above the composer. */
export function TodoList(props: { sessionID: string }) {
  const [collapsed, setCollapsed] = createSignal(false);

  // hydrate from server + keep live via todo.updated SSE -> todoStore
  createQuery(() => ({
    queryKey: ["todos", props.sessionID],
    queryFn: async () => {
      if (props.sessionID.startsWith("demo")) return DEMO_TODOS;
      try {
        const todos = await adapter.getTodos(props.sessionID);
        todoStore.setTodos(props.sessionID, todos);
        return todos;
      } catch {
        return todoStore.todosFor(props.sessionID);
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
    enabled: !props.sessionID.startsWith("demo"),
  }));

  const todos = (): Todo[] => {
    const live = todoStore.todosFor(props.sessionID);
    if (live.length > 0) return live;
    if (props.sessionID.startsWith("demo")) return DEMO_TODOS;
    return live;
  };

  const done = () => todos().filter((t) => t.status === "completed").length;
  const total = () => todos().length;

  return (
    <Show when={todos().length > 0}>
      <div class="todo-wrap">
        <div class="todo-panel">
          <button type="button" class="todo-head" onClick={() => setCollapsed(!collapsed())} aria-expanded={!collapsed()}>
            <span class="todo-head-left">
              <ListTodo size={14} />
              Tasks
              <span class="todo-count">
                {done()}/{total()}
              </span>
            </span>
            <span class="todo-head-right">
              <Show when={!collapsed()} fallback={<span class="todo-hint">{total()} todos</span>}>
                <span class="todo-progress">
                  <span class="todo-progress-bar" style={`width:${total() ? (done() / total()) * 100 : 0}%`} />
                </span>
                <span class="mono" style="font-size:11px">
                  {done()}/{total()}
                </span>
              </Show>
              <ChevronDown size={14} class={`todo-chev ${collapsed() ? "" : "open"}`} />
            </span>
          </button>
          <Show when={!collapsed()}>
            <div class="todo-list">
              <For each={todos()}>
                {(t) => {
                  const Icon = statusIcon(t.status);
                  const isSpin = t.status === "in_progress";
                  return (
                    <div class={`todo-item ${t.status}`}>
                      <span class={statusClass(t.status)}>
                        <Icon size={13} class={isSpin ? "spin" : undefined} />
                      </span>
                      <span class="todo-content">{t.content}</span>
                      <Show when={t.priority}>
                        <span class={priorityClass(t.priority)}>{t.priority}</span>
                      </Show>
                    </div>
                  );
                }}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
