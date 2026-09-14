import { useParams } from "@solidjs/router";
import { Show, createEffect } from "solid-js";
import { ChatView, DemoConversation } from "../components/chat/ChatView";
import { PromptInput } from "../components/chat/PromptInput";
import { QuestionList } from "../components/chat/QuestionList";
import { TodoList } from "../components/chat/TodoList";
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
          <div style="flex:1;display:flex;flex-direction:column;min-height:0;background:var(--bg)">
            <DemoConversation />
            <TodoList sessionID="demo" />
            <QuestionList sessionID="demo" />
            <PromptInput sending={false} onSend={() => {}} />
          </div>
        }
      >
        {(sid) => <ChatView sessionID={sid()} />}
      </Show>
    </div>
  );
}
