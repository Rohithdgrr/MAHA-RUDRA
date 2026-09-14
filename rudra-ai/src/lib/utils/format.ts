export function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

export function truncate(text: string, max = 60): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export function sessionTitle(title: string | undefined, fallback: string): string {
  const t = (title ?? "").trim();
  return t ? truncate(t, 48) : fallback;
}
