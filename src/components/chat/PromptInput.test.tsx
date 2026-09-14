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
    expect((getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows loading state while sending", () => {
    const { getByRole } = renderWithQuery(() => <PromptInput sending={true} onSend={() => undefined} />);
    expect((getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });
});
