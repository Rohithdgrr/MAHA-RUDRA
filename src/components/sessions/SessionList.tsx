import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { For, Show } from "solid-js";
import { adapter } from "../../lib/backend";
import { strings } from "../../lib/i18n/en";
import { sessionStore } from "../../lib/stores/session.store";
import { uiStore } from "../../lib/stores/ui.store";
import { logger } from "../../lib/utils/logger";
import { SessionItem } from "./SessionItem";

/** Session list backed by TanStack Query; mirrors into sessionStore. */
export function SessionList() {
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
    try {
      await adapter.deleteSession(id);
      sessionStore.removeSession(id);
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      uiStore.toast("Session deleted", "success");
    } catch (err) {
      logger.error(err);
      uiStore.toast((err as Error).message, "error");
    }
  }

  return (
    <div style="padding:8px;display:flex;flex-direction:column;gap:4px">
      <Show when={query.isPending}>
        <p style="color:var(--muted);font-size:12px;padding:8px">{strings.loading}</p>
      </Show>
      <Show when={query.isError}>
        <p style="color:var(--danger);font-size:12px;padding:8px">
          {(query.error as Error)?.message ?? "Failed to load sessions"}
        </p>
      </Show>
      <Show when={query.isSuccess && (query.data?.length ?? 0) === 0}>
        <p style="color:var(--muted);font-size:12px;padding:8px">{strings.noSessions}</p>
      </Show>
      <For each={sessionStore.state.sessions}>{(s) => <SessionItem session={s} onDelete={onDelete} />}</For>
    </div>
  );
}
