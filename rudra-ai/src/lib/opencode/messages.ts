import { adapter } from "../backend";
import type { MessageWithParts, SendPromptInput } from "../backend/types";

export async function getMessages(sessionID: string): Promise<MessageWithParts[]> {
  return adapter.getMessages(sessionID);
}

export async function sendPrompt(input: SendPromptInput): Promise<void> {
  return adapter.sendPrompt(input);
}
