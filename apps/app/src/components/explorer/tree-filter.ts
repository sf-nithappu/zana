import type { FsEntry } from '@zana-ai/zcc-domain/product';

export interface FilteredTree {
  /** Listings reduced to matching rows and the ancestors that lead to them. */
  entries: Map<string, FsEntry[]>;
  /** Folders to show open so every match is reachable. */
  expanded: Map<string, boolean>;
  matchCount: number;
}

/**
 * Filter the already-loaded part of the tree by name (case-insensitive
 * substring). Folders that were never opened have no listing here, so they are
 * not searched. Pure: callers keep their real `entries` / `expanded` untouched,
 * which is what makes clearing the filter restore the prior view.
 */
export function filterLoadedTree(
  root: string,
  entries: ReadonlyMap<string, FsEntry[]>,
  query: string
): FilteredTree {
  const needle = query.trim().toLowerCase();
  const out: FilteredTree = { entries: new Map(), expanded: new Map(), matchCount: 0 };
  if (needle === '') return out;

  const visit = (path: string, seen: Set<string>): FsEntry[] => {
    const children = entries.get(path);
    if (!children || seen.has(path)) return [];
    seen.add(path);
    const kept: FsEntry[] = [];
    for (const child of children) {
      const nameMatches = child.name.toLowerCase().includes(needle);
      const keptBelow = child.kind === 'dir' ? visit(child.path, seen) : [];
      if (nameMatches) out.matchCount++;
      if (nameMatches || keptBelow.length > 0) {
        kept.push(child);
        if (keptBelow.length > 0) out.expanded.set(child.path, true);
      }
    }
    seen.delete(path);
    out.entries.set(path, kept);
    return kept;
  };
  visit(root, new Set());
  return out;
}
