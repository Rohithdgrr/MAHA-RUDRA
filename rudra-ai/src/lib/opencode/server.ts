/**
 * Server-side guards for `opencode serve` connections.
 * Pure helpers — the Connect page renders warnings from these;
 * nothing here refuses a connection (remote servers are a feature).
 */

/** Minimum server release with the current auth hardening. Warn below this. */
export const MIN_OPENCODE_VERSION = "1.0.216";

function numSegments(version: string): number[] | undefined {
  const cleaned = version.trim().replace(/^v/i, "");
  if (!cleaned) return undefined;
  const parts = cleaned.split(".");
  const out: number[] = [];
  for (const p of parts) {
    const m = /^(\d+)/.exec(p);
    if (!m) return undefined;
    out.push(Number(m[1]));
  }
  return out.length > 0 ? out : undefined;
}

/** True when `version` is known and >= `min`. Unknown versions return false. */
export function isVersionAtLeast(version: string | undefined, min = MIN_OPENCODE_VERSION): boolean {
  if (!version) return false;
  const v = numSegments(version);
  const floor = numSegments(min);
  if (!v || !floor) return false;
  const len = Math.max(v.length, floor.length);
  for (let i = 0; i < len; i++) {
    const a = v[i] ?? 0;
    const b = floor[i] ?? 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return true;
}

export function isLoopbackHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return h === "localhost" || h.endsWith(".localhost") || h === "::1" || /^127\.\d+\.\d+\.\d+$/.test(h);
}

export type ServerUrlCheck =
  | { ok: true; url: string; remote: boolean }
  | { ok: false; error: string };

/** Validate + normalize a server URL. Remote (non-loopback) hosts are flagged, not blocked. */
export function validateServerUrl(raw: string): ServerUrlCheck {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return { ok: false, error: "Server URL is required" };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "Enter a valid http(s) server URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Server URL must use http or https" };
  }
  if (!parsed.hostname) return { ok: false, error: "Enter a valid http(s) server URL" };
  return { ok: true, url: trimmed, remote: !isLoopbackHost(parsed.hostname) };
}
