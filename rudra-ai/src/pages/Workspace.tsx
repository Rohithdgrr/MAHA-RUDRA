import { useNavigate, useParams } from "@solidjs/router";
import { Show, createEffect } from "solid-js";
import { ChatView, DemoConversation } from "../components/chat/ChatView";
import { PromptInput } from "../components/chat/PromptInput";
import { QuestionList } from "../components/chat/QuestionList";
import { TodoList } from "../components/chat/TodoList";
import { ensureSessionLoaded } from "../lib/session/actions";
import { messageStore } from "../lib/stores/message.store";
import { sessionStore } from "../lib/stores/session.store";
import { uiStore } from "../lib/stores/ui.store";
import { logger } from "../lib/utils/logger";

/**
 * Workspace: chat for the routed session, or an empty-state prompt.
 * The route param owns `activeID`; `keyed` remounts ChatView per session so
 * messages/todos/questions never bleed across a switch.
 */
export function Workspace() {
  const params = useParams();
  const navigate = useNavigate();
  const id = () => params.id as string | undefined;
  let prevID: string | undefined;

  createEffect(() => {
    const sid = id();
    // Leaving/switching sessions clears leftover banners from the old one —
    // but not on unrelated store refreshes for the same session.
    if (sid !== prevID) {
      messageStore.setError(undefined);
      prevID = sid;
    }
    if (!sid) {
      sessionStore.setActive(undefined);
      return;
    }
    sessionStore.setActive(sid);
    if (!sessionStore.state.sessions.some((s) => s.id === sid)) {
      void ensureSessionLoaded(sid).then((ok) => {
        if (!ok) {
          logger.warn(`Unknown session ${sid}; returning home`);
          uiStore.toast("That session no longer exists.", "error");
          sessionStore.setActive(undefined);
          navigate("/", { replace: true });
        }
      });
    }
  });

  return (
    <div style="flex:1;display:flex;flex-direction:column;min-height:0">
      <Show
        when={id()}
        keyed
        fallback={
          <div style="flex:1;display:flex;flex-direction:column;min-height:0;background:var(--bg)">
            <DemoConversation />
            <TodoList sessionID="demo" />
            <QuestionList sessionID="demo" />
            <PromptInput sending={false} onSend={() => {}} />
          </div>
        }
      >
        {(sid) => <ChatView sessionID={sid} />}
      </Show>
    </div>
  );
}
