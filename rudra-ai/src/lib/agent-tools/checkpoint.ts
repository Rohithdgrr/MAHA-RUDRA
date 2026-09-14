/** checkpoint / restore: snapshot + rollback. In-memory sidecar; never touches real git history. */
import { ToolError } from "./types";
import type { FileSystem } from "./batch-edit";

export interface Snapshot {
  id: string;
  label: string;
  at: number;
  files: Record<string, string | null>;
}

export interface CheckpointStore {
  save(s: Snapshot): void;
  get(idOrLabel: string): Snapshot | undefined;
  list(): Snapshot[];
  prune(max: number): void;
}

const MAX_SNAPSHOTS = 20;

export class MemoryCheckpointStore implements CheckpointStore {
  private items: Snapshot[] = [];
  private seq = 0;
  save(s: Snapshot): void {
    this.items.push(s);
    this.seq++;
    this.prune(MAX_SNAPSHOTS);
  }
  nextId(label: string): string {
    this.seq++;
    return `cp_${this.seq}_${label.replace(/[^a-z0-9]+/gi, "-").slice(0, 24) || "x"}`;
  }
  get(idOrLabel: string): Snapshot | undefined {
    return (
      this.items.find((s) => s.id === idOrLabel) ??
      [...this.items].reverse().find((s) => s.label === idOrLabel)
    );
  }
  list(): Snapshot[] {
    return [...this.items];
  }
  prune(max: number): void {
    if (this.items.length > max) this.items = this.items.slice(this.items.length - max);
  }
}

export interface CheckpointInput {
  label: string;
  files?: string[];
}

const TRACKED_EXCLUDES = ["node_modules/", "dist/", "target/", ".git/"];

function isExcluded(p: string): boolean {
  return TRACKED_EXCLUDES.some((d) => p.replace(/\\/g, "/").includes(d));
}

export async function checkpoint(
  fs: FileSystem,
  store: MemoryCheckpointStore,
  knownFiles: string[],
  input: CheckpointInput,
): Promise<Snapshot> {
  const label = (input.label ?? "").trim();
  if (!label) throw new ToolError("BAD_INPUT", "label must be non-empty");
  if (label.length > 120) throw new ToolError("BAD_INPUT", "label too long (max 120)");
  const files = (input.files ?? knownFiles).filter((f) => !isExcluded(f)).slice(0, 500);
  const snapFiles: Record<string, string | null> = {};
  for (const f of files) {
    try {
      const exists = await fs.exists(f);
      snapFiles[f] = exists ? await fs.readFile(f) : null;
    } catch {
      snapFiles[f] = null;
    }
  }
  const snap: Snapshot = { id: store.nextId(label), label, at: Date.now(), files: snapFiles };
  store.save(snap);
  return snap;
}

export async function restore(
  fs: FileSystem,
  store: CheckpointStore,
  idOrLabel: string,
): Promise<{ restored: string[]; missing: string[] }> {
  if (!idOrLabel.trim()) throw new ToolError("BAD_INPUT", "label_or_id must be non-empty");
  const snap = store.get(idOrLabel);
  if (!snap) throw new ToolError("NOT_FOUND", `no checkpoint: ${idOrLabel}`);
  const restored: string[] = [];
  const missing: string[] = [];
  for (const [file, content] of Object.entries(snap.files)) {
    try {
      if (content === null) {
        if (await fs.exists(file)) await fs.delete(file);
      } else {
        await fs.writeFile(file, content);
      }
      restored.push(file);
    } catch {
      missing.push(file);
    }
  }
  return { restored, missing };
}
