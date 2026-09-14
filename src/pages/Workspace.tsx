import { useParams } from "@solidjs/router";
import { Show, createEffect } from "solid-js";
import { ChatView } from "../components/chat/ChatView";
import { strings } from "../lib/i18n/en";
import { sessionStore } from "../lib/stores/session.store";

/** Workspace: chat for the active session, or an empty-state prompt. */
export function Workspace() {
  const params = useParams();
  const id = () => params.id as string | undefined;

  createEffect(() => {
    sessionStore.setActive(id());
  });

  return (
    <div style="flex:1;display:flex;flex-direction:column;min-height:0">
      <Show
        when={id()}
        fallback={
          <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:24px">
            <p style="color:var(--muted);font-size:14px">{strings.selectSession}</p>
          </div>
        }
      >
        {(sid) => <ChatView sessionID={sid()} />}
      </Show>
    </div>
  );
}
