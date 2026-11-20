import { describe, expect, it } from 'vitest';
import type { FsEntry } from '@zana-ai/zcc-domain/product';
import { filterLoadedTree } from './tree-filter.js';

const dir = (path: string): FsEntry => ({ name: path.split('/').pop()!, kind: 'dir', path });
const file = (path: string): FsEntry => ({ name: path.split('/').pop()!, kind: 'file', path });

const entries = new Map<string, FsEntry[]>([
  ['/r', [dir('/r/src'), dir('/r/docs'), dir('/r/unopened'), file('/r/Readme.md')]],
  ['/r/src', [dir('/r/src/lib'), file('/r/src/app.ts')]],
  ['/r/src/lib', [file('/r/src/lib/Util.ts'), file('/r/src/lib/other.ts')]],
  ['/r/docs', [file('/r/docs/guide.md')]]
]);

describe('filterLoadedTree', () => {
  it('keeps matches and their ancestors, expanding the ancestors', () => {
    const r = filterLoadedTree('/r', entries, 'util');
    expect(r.matchCount).toBe(1);
    expect(r.entries.get('/r')!.map((e) => e.name)).toEqual(['src']);
    expect(r.entries.get('/r/src')!.map((e) => e.name)).toEqual(['lib']);
    expect(r.entries.get('/r/src/lib')!.map((e) => e.name)).toEqual(['Util.ts']);
    expect([...r.expanded.keys()].sort()).toEqual(['/r/src', '/r/src/lib']);
  });

  it('is case-insensitive and trims the query', () => {
    expect(filterLoadedTree('/r', entries, '  README ').matchCount).toBe(1);
  });

  it('keeps a matching folder but only its matching contents', () => {
    const r = filterLoadedTree('/r', entries, 'docs');
    expect(r.entries.get('/r')!.map((e) => e.name)).toEqual(['docs']);
    expect(r.entries.get('/r/docs')).toEqual([]);
    expect(r.expanded.has('/r/docs')).toBe(false);
  });

  it('does not search folders that were never loaded', () => {
    const r = filterLoadedTree('/r', entries, 'hidden-inside-unopened');
    expect(r.matchCount).toBe(0);
    expect(r.entries.get('/r')).toEqual([]);
  });

  it('returns an empty result for a blank query or missing root', () => {
    expect(filterLoadedTree('/r', entries, '   ').entries.size).toBe(0);
    expect(filterLoadedTree('/missing', entries, 'a').matchCount).toBe(0);
  });
});
