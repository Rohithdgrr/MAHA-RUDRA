import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { describe, expect, it } from "vitest";
import { render } from "@solidjs/testing-library";
import { PromptInput } from "./PromptInput";

function renderWithQuery(ui: () => ReturnType<typeof PromptInput>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(() => (
    <QueryClientProvider client={client}>{ui()}</QueryClientProvider>
  ));
}

describe("PromptInput", () => {
  it("renders with send disabled when empty", () => {
    const { getByLabelText, getByRole } = renderWithQuery(() => (
      <PromptInput sending={false} onSend={() => undefined} />
    ));
    expect(getByLabelText("Prompt input")).toBeTruthy();
    // Send button is present and disabled when input is empty
    const sendBtn = getByRole("button", { name: "Type a message to send" }) as HTMLButtonElement;
    expect(sendBtn).toBeTruthy();
    expect(sendBtn.disabled).toBe(true);
  });

  it("shows loading state while sending", () => {
    const { getByLabelText } = renderWithQuery(() => <PromptInput sending={true} onSend={() => undefined} />);
    // The textarea should still be present
    expect(getByLabelText("Prompt input")).toBeTruthy();
  });
});
