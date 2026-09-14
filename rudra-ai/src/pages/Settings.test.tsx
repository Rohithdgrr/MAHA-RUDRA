import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { describe, expect, it } from "vitest";
import { render } from "@solidjs/testing-library";
import { SettingsDialog } from "./Settings";
import { AgentTab } from "../components/settings/AgentTab";

function renderWithQuery(ui: () => unknown) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(() => (
    <QueryClientProvider client={client}>{ui() as never}</QueryClientProvider>
  ));
}

describe("SettingsDialog", () => {
  it("renders the four section tabs without duplicates or save bar", () => {
    const { getByText, queryByText } = renderWithQuery(() => (
      <SettingsDialog open={true} onClose={() => undefined} />
    ));
    expect(getByText("Workspace Settings")).toBeTruthy();
    expect(getByText("General")).toBeTruthy();
    expect(getByText("Model")).toBeTruthy();
    expect(getByText("Agent")).toBeTruthy();
    expect(getByText("Memory")).toBeTruthy();
    expect(queryByText("Models & Fallbacks")).toBeNull();
    expect(queryByText("Tool Execution & Safety")).toBeNull();
    expect(queryByText("Local Daemon")).toBeNull();
    expect(queryByText("Cost & Token Limits")).toBeNull();
    expect(queryByText("Save Changes")).toBeNull();
    expect(queryByText("Keyboard shortcuts")).toBeTruthy();
    expect(getByText("Reset all settings")).toBeTruthy();
    // Approval controls moved out of General — no duplicates.
    expect(queryByText("Tool Approval Mode")).toBeNull();
    expect(queryByText("Default Agent Model")).toBeNull();
  });

  it("renders nothing when closed", () => {
    const { queryByText } = renderWithQuery(() => (
      <SettingsDialog open={false} onClose={() => undefined} />
    ));
    expect(queryByText("Workspace Settings")).toBeNull();
  });
});

describe("AgentTab", () => {
  it("shows approval modes with autonomous available", () => {
    const { getByText } = renderWithQuery(() => <AgentTab />);
    expect(getByText("Tool Approval Mode")).toBeTruthy();
    expect(getByText("Autonomous")).toBeTruthy();
    expect(getByText("Confirm shell commands")).toBeTruthy();
  });
});
