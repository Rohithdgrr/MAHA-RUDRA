import { createStore } from "solid-js/store";
import type { Todo } from "@opencode-ai/sdk/client";

interface TodoState {
  bySession: Record<string, Todo[]>;
}

const [state, setState] = createStore<TodoState>({
  bySession: {},
});

export const todoStore = {
  get state() {
    return state;
  },
  todosFor(sessionID: string | undefined): Todo[] {
    if (!sessionID) return [];
    return state.bySession[sessionID] ?? [];
  },
  setTodos(sessionID: string, todos: Todo[]) {
    setState("bySession", sessionID, [...todos]);
  },
  clear(sessionID: string) {
    setState("bySession", sessionID, []);
  },
};
