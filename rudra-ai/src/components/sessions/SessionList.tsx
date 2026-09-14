import { useNavigate } from "@solidjs/router";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { For, Show } from "solid-js";
import { adapter } from "../../lib/backend";
import { strings } from "../../lib/i18n/en";
import { deleteSessionAndLeave } from "../../lib/session/actions";
import { sessionStore } from "../../lib/stores/session.store";
import { SessionItem } from "./SessionItem";

/** Session list backed by TanStack Query; mirrors into sessionStore. */
export function SessionList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = createQuery(() => ({
    queryKey: ["sessions"],
    queryFn: async () => {
      const sessions = await adapter.listSessions();
      sessionStore.setSessions(sessions);
      return sessions;
    },
    retry: false,
    refetchOnWindowFocus: false,
  }));

  async function onDelete(id: string) {
    // Shared helper navigates away when the active session is deleted, so
    // the UI never sits on a dead `/s/:id` route.
    await deleteSessionAndLeave(navigate, id, () =>
      queryClient.invalidateQueries({ queryKey: ["sessions"] }),
    );
  }

  const demo = () => sessionStore.state.sessions.length === 0 && !query.isPending;

  return (
    <div style="display:flex;flex-direction:column;gap:2px">
      <Show when={query.isPending}>
        <p style="color:var(--muted);font-size:12px;padding:8px 10px">{strings.loading}</p>
      </Show>
      <Show when={query.isError}>
        <p style="color:var(--danger);font-size:12px;padding:8px 10px">
          {(query.error as Error)?.message ?? "Failed to load sessions"}
        </p>
      </Show>
      <For each={sessionStore.state.sessions}>{(s) => <SessionItem session={s} onDelete={onDelete} />}</For>
      <Show when={demo()}>
        <SessionItem forceActive session={{ id: "demo-1", title: "Rust HTTP Server", time: { updated: Date.now() } } as never} onDelete={() => {}} />
        <SessionItem session={{ id: "demo-2", title: "Python Async Scraper", time: { updated: Date.now() } } as never} onDelete={() => {}} />
        <SessionItem session={{ id: "demo-3", title: "Debug Memory Leak", time: { updated: Date.now() } } as never} onDelete={() => {}} />
        <SessionItem session={{ id: "demo-4", title: "React Refactor", time: { updated: Date.now() } } as never} onDelete={() => {}} />
      </Show>
    </div>
  );
}
