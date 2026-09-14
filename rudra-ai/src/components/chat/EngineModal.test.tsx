import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { describe, expect, it } from "vitest";
import { render } from "@solidjs/testing-library";
import { EngineModal } from "./EngineModal";

function renderWithQuery(ui: () => unknown) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(() => (
    <QueryClientProvider client={client}>{ui() as never}</QueryClientProvider>
  ));
}

describe("EngineModal", () => {
  it("renders header, search, tabs and footer when open", () => {
    const { getByText, getByPlaceholderText } = renderWithQuery(() => (
      <EngineModal open={true} onClose={() => undefined} />
    ));
    expect(getByText("Select active engine")).toBeTruthy();
    expect(getByPlaceholderText(/Search models, providers/)).toBeTruthy();
    expect(getByText("All")).toBeTruthy();
    expect(getByText("Fast")).toBeTruthy();
    expect(getByText("Reasoning")).toBeTruthy();
    expect(getByText("Local Ollama")).toBeTruthy();
    expect(getByText("Configure custom API keys in Settings")).toBeTruthy();
  });

  it("renders nothing when closed", () => {
    const { queryByText } = renderWithQuery(() => (
      <EngineModal open={false} onClose={() => undefined} />
    ));
    expect(queryByText("Select active engine")).toBeNull();
  });
});
