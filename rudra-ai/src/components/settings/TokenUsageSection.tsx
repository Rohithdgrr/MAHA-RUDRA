import { For, Show } from "solid-js";
import { formatTokens } from "../../lib/utils/tokens";
import { TOKEN_BUCKETS, cacheHitRate, mergeLedgers } from "../../lib/metrics/token-ledger";
import { rankTools } from "../../lib/metrics/tool-efficiency";
import { flagRegression } from "../../lib/metrics/regression";
import { usageStore } from "../../lib/metrics/usage-store";
import { Section } from "./controls";

const BUCKET_LABELS: Record<string, string> = {
  system: "System + memory",
  tools: "Tool schemas",
  history: "History",
  tool_out: "Tool outputs",
  reasoning: "Reasoning",
  output: "Model output",
  cached: "Prompt cache hits",
  unattributed: "Prompt (server total)",
};

/** Phase 0 surface: token ledger, tool ranking, regression flag. Read-only + baseline setter. */
export function TokenUsageSection() {
  const global = () => usageStore.global();
  const baseline = () => usageStore.state.baselines["global"];
  const verdict = () => {
    const b = baseline();
    const cur = global().perTask;
    if (b === undefined || cur === undefined) return undefined;
    return flagRegression(b, cur);
  };
  const ranked = () => rankTools(usageStore.state.toolStats).slice(0, 5);
  const buckets = () => {
    const all = Object.values(usageStore.state.ledgers);
    const sums = new Map<string, number>();
    for (const l of all) {
      for (const b of TOKEN_BUCKETS) {
        sums.set(b, (sums.get(b) ?? 0) + l.buckets[b].tokens);
      }
    }
    return [...sums.entries()].filter(([, v]) => v > 0);
  };
  const hitRate = () => {
    const all = Object.values(usageStore.state.ledgers);
    if (all.length === 0) return undefined;
    return cacheHitRate(mergeLedgers(all));
  };
  return (
    <Section
      title="Token Usage & Efficiency"
      right={
        <button
          type="button"
          onClick={() => {
            const cur = global().perTask;
            if (cur !== undefined) usageStore.setBaseline("global", cur);
          }}
          style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--muted);cursor:pointer"
        >
          Set current as baseline
        </button>
      }
    >
      <div style="font-size:12px;color:var(--muted);line-height:1.7">
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          <span>
            Session tokens: <strong style="color:var(--fg)">{formatTokens(global().tokens)}</strong>
          </span>
          <span>
            Tasks:{" "}
            <strong style="color:var(--fg)">
              {global().tasksSucceeded}/{global().tasksTotal}
            </strong>
          </span>
          <Show when={global().perTask !== undefined}>
            <span>
              Per successful task: <strong style="color:var(--fg)">{formatTokens(global().perTask ?? 0)}</strong>
            </span>
          </Show>
          <Show when={hitRate() !== undefined}>
            <span>
              Prefix cache hits: <strong style="color:var(--fg)">{(((hitRate() ?? 0) * 100).toFixed(0))}%</strong>
            </span>
          </Show>
        </div>
        <Show when={buckets().length > 0}>
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
            <For each={buckets()}>
              {([b, v]) => (
                <span style="font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--border)">
                  {BUCKET_LABELS[b] ?? b}: {formatTokens(v)}
                </span>
              )}
            </For>
          </div>
        </Show>
        <Show when={verdict() !== undefined}>
          <div
            style={`margin-top:8px;font-size:11px;font-weight:700;color:${(verdict()?.regressed ?? false) ? "var(--danger)" : "var(--success)"}`}
          >
            {(verdict()?.regressed ?? false)
              ? `Token regression: +${(((verdict()?.change ?? 0) * 100).toFixed(0))}% per task vs baseline`
              : "No token regression vs baseline"}
          </div>
        </Show>
        <Show when={ranked().length > 0}>
          <div style="margin-top:8px;font-size:11px">
            <div style="font-weight:700;margin-bottom:4px">Costliest tools per useful result</div>
            <For each={ranked()}>
              {(r) => (
                <div style="display:flex;justify-content:space-between;max-width:420px">
                  <span style="font-family:ui-monospace,monospace">{r.tool}</span>
                  <span>{r.tokensPerUseful === undefined ? "no useful results yet" : `${formatTokens(r.tokensPerUseful)}/useful`}</span>
                </div>
              )}
            </For>
          </div>
        </Show>
        <Show when={buckets().length === 0}>
          <div style="margin-top:4px;font-size:11px">No usage recorded yet this workspace.</div>
        </Show>
      </div>
    </Section>
  );
}
