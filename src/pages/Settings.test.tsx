import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { describe, expect, it } from "vitest";
import { render } from "@solidjs/testing-library";
import { SettingsDialog } from "./Settings";

function renderWithQuery(ui: () => unknown) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(() => (
    <QueryClientProvider client={client}>{ui() as never}</QueryClientProvider>
  ));
}

describe("SettingsDialog", () => {
  it("renders tabs and general controls when open", () => {
    const { getByText, queryByText } = renderWithQuery(() => (
      <SettingsDialog open={true} onClose={() => undefined} />
    ));
    expect(getByText("Workspace Settings")).toBeTruthy();
    expect(getByText("General")).toBeTruthy();
    expect(getByText("Models & Fallbacks")).toBeTruthy();
    expect(getByText("Tool Execution & Safety")).toBeTruthy();
    expect(getByText("Local Daemon")).toBeTruthy();
    expect(getByText("Cost & Token Limits")).toBeTruthy();
    expect(getByText("Tool Approval Mode")).toBeTruthy();
    expect(getByText("Always Ask")).toBeTruthy();
    expect(getByText("Save Changes")).toBeTruthy();
    expect(queryByText("Keyboard shortcuts")).toBeTruthy();
  });

  it("renders nothing when closed", () => {
    const { queryByText } = renderWithQuery(() => (
      <SettingsDialog open={false} onClose={() => undefined} />
    ));
    expect(queryByText("Workspace Settings")).toBeNull();
  });
});
