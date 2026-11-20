import type { FsEntry } from '@zana-ai/zcc-domain/product';
import { compactChain } from './compact-chain.js';

/** One rendered tree row, in on-screen order. `path` is the row's `data-path`. */
export interface VisibleRow {
  entry: FsEntry;
  path: string;
  depth: number;
  /** Path of the enclosing visible row, or null at the root. */
  parent: string | null;
  open: boolean;
}

/** Mirrors what `TreeList` renders so keyboard order always matches the screen. */
export function flattenVisibleRows(
  list: readonly FsEntry[] | undefined,
  entries: ReadonlyMap<string, FsEntry[]>,
  expanded: ReadonlyMap<string, boolean>,
  compact: boolean
): VisibleRow[] {
  const rows: VisibleRow[] = [];
  const walk = (items: readonly FsEntry[], depth: number, parent: string | null) => {
    for (const head of items) {
      const chain = compact ? compactChain(head, entries, expanded) : [head];
      const entry = chain[chain.length - 1]!;
      const open = entry.kind === 'dir' && expanded.get(entry.path) === true;
      rows.push({ entry, path: entry.path, depth, parent, open });
      const children = open ? entries.get(entry.path) : undefined;
      if (children) walk(children, depth + 1, entry.path);
    }
  };
  if (list) walk(list, 0, null);
  return rows;
}

export type TreeKeyAction =
  | { type: 'focus'; path: string }
  | { type: 'toggle'; entry: FsEntry }
  | { type: 'open'; entry: FsEntry }
  | { type: 'rename'; entry: FsEntry }
  | { type: 'delete'; entry: FsEntry };

/** Decide what a navigation key does. Returns null for keys the tree ignores. */
export function resolveTreeKey(
  rows: readonly VisibleRow[],
  focusedPath: string | null,
  key: string
): TreeKeyAction | null {
  if (rows.length === 0) return null;
  const index = focusedPath === null ? -1 : rows.findIndex((row) => row.path === focusedPath);
  const current = index >= 0 ? rows[index]! : null;
  const focus = (i: number): TreeKeyAction => ({ type: 'focus', path: rows[Math.max(0, Math.min(rows.length - 1, i))]!.path });
  switch (key) {
    case 'ArrowDown':
      return focus(index + 1);
    case 'ArrowUp':
      return focus(index < 0 ? 0 : index - 1);
    case 'Home':
      return focus(0);
    case 'End':
      return focus(rows.length - 1);
    case 'ArrowRight': {
      if (!current) return focus(0);
      if (current.entry.kind !== 'dir') return null;
      if (!current.open) return { type: 'toggle', entry: current.entry };
      const next = rows[index + 1];
      return next && next.parent === current.path ? { type: 'focus', path: next.path } : null;
    }
    case 'ArrowLeft': {
      if (!current) return focus(0);
      if (current.open) return { type: 'toggle', entry: current.entry };
      return current.parent ? { type: 'focus', path: current.parent } : null;
    }
    case 'Enter':
      if (!current) return null;
      return current.entry.kind === 'dir'
        ? { type: 'toggle', entry: current.entry }
        : { type: 'open', entry: current.entry };
    case 'F2':
      return current ? { type: 'rename', entry: current.entry } : null;
    case 'Delete':
      return current ? { type: 'delete', entry: current.entry } : null;
    default:
      return null;
  }
}

/** Next row (after the focused one, wrapping) whose name starts with `prefix`. */
export function typeAheadMatch(
  rows: readonly VisibleRow[],
  focusedPath: string | null,
  prefix: string
): string | null {
  if (rows.length === 0 || prefix === '') return null;
  const needle = prefix.toLowerCase();
  const start = focusedPath === null ? 0 : rows.findIndex((row) => row.path === focusedPath);
  // A growing prefix ("ap" → "app") may still match the focused row itself.
  const offset = prefix.length > 1 ? 0 : 1;
  for (let step = 0; step < rows.length; step++) {
    const row = rows[(Math.max(start, 0) + offset + step) % rows.length]!;
    if (row.entry.name.toLowerCase().startsWith(needle)) return row.path;
  }
  return null;
}
