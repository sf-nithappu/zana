import { describe, expect, it } from 'vitest';
import type { FsEntry } from '@zana-ai/zcc-domain/product';
import { flattenVisibleRows, resolveTreeKey, typeAheadMatch } from './tree-keyboard.js';

const dir = (path: string): FsEntry => ({ name: path.split('/').pop()!, kind: 'dir', path });
const file = (path: string): FsEntry => ({ name: path.split('/').pop()!, kind: 'file', path });

const src = dir('/r/src');
const lib = dir('/r/src/lib');
const readme = file('/r/README.md');
const entries = new Map<string, FsEntry[]>([
  ['/r', [src, readme]],
  ['/r/src', [lib, file('/r/src/app.ts')]],
  ['/r/src/lib', [file('/r/src/lib/util.ts')]]
]);
const rootList = entries.get('/r')!;
const open = (...paths: string[]) => new Map(paths.map((p) => [p, true] as [string, boolean]));

describe('flattenVisibleRows', () => {
  it('lists only rows under expanded folders, with depth and parent', () => {
    const rows = flattenVisibleRows(rootList, entries, open('/r/src'), false);
    expect(rows.map((r) => [r.path, r.depth, r.parent, r.open])).toEqual([
      ['/r/src', 0, null, true],
      ['/r/src/lib', 1, '/r/src', false],
      ['/r/src/app.ts', 1, '/r/src', false],
      ['/r/README.md', 0, null, false]
    ]);
  });

  it('is empty without a listing and skips unloaded children', () => {
    expect(flattenVisibleRows(undefined, entries, new Map(), false)).toEqual([]);
    const rows = flattenVisibleRows([src], new Map(), open('/r/src'), false);
    expect(rows).toHaveLength(1);
  });

  it('mirrors compact chains by using the chain tail', () => {
    const only = new Map<string, FsEntry[]>([['/r/a', [dir('/r/a/b')]], ['/r/a/b', [file('/r/a/b/x')]]]);
    const rows = flattenVisibleRows([dir('/r/a')], only, open('/r/a', '/r/a/b'), true);
    expect(rows.map((r) => [r.path, r.depth])).toEqual([['/r/a/b', 0], ['/r/a/b/x', 1]]);
  });
});

describe('resolveTreeKey', () => {
  const rows = flattenVisibleRows(rootList, entries, open('/r/src'), false);

  it('moves and clamps with arrows, Home and End', () => {
    expect(resolveTreeKey(rows, null, 'ArrowDown')).toEqual({ type: 'focus', path: '/r/src' });
    expect(resolveTreeKey(rows, '/r/src', 'ArrowDown')).toEqual({ type: 'focus', path: '/r/src/lib' });
    expect(resolveTreeKey(rows, '/r/src', 'ArrowUp')).toEqual({ type: 'focus', path: '/r/src' });
    expect(resolveTreeKey(rows, null, 'ArrowUp')).toEqual({ type: 'focus', path: '/r/src' });
    expect(resolveTreeKey(rows, '/r/README.md', 'ArrowDown')).toEqual({ type: 'focus', path: '/r/README.md' });
    expect(resolveTreeKey(rows, '/r/src/lib', 'Home')).toEqual({ type: 'focus', path: '/r/src' });
    expect(resolveTreeKey(rows, '/r/src', 'End')).toEqual({ type: 'focus', path: '/r/README.md' });
  });

  it('ArrowRight expands a closed folder, enters an open one, ignores files', () => {
    expect(resolveTreeKey(rows, '/r/src/lib', 'ArrowRight')).toEqual({ type: 'toggle', entry: lib });
    expect(resolveTreeKey(rows, '/r/src', 'ArrowRight')).toEqual({ type: 'focus', path: '/r/src/lib' });
    expect(resolveTreeKey(rows, '/r/README.md', 'ArrowRight')).toBeNull();
    expect(resolveTreeKey(rows, null, 'ArrowRight')).toEqual({ type: 'focus', path: '/r/src' });
  });

  it('ArrowRight on an open but empty folder does nothing', () => {
    const emptyRows = flattenVisibleRows([src, readme], new Map([['/r/src', []]]), open('/r/src'), false);
    expect(resolveTreeKey(emptyRows, '/r/src', 'ArrowRight')).toBeNull();
  });

  it('ArrowLeft collapses an open folder, else goes to the parent', () => {
    expect(resolveTreeKey(rows, '/r/src', 'ArrowLeft')).toEqual({ type: 'toggle', entry: src });
    expect(resolveTreeKey(rows, '/r/src/app.ts', 'ArrowLeft')).toEqual({ type: 'focus', path: '/r/src' });
    expect(resolveTreeKey(rows, '/r/README.md', 'ArrowLeft')).toBeNull();
    expect(resolveTreeKey(rows, null, 'ArrowLeft')).toEqual({ type: 'focus', path: '/r/src' });
  });

  it('Enter opens files and toggles folders; F2 and Delete target the row', () => {
    expect(resolveTreeKey(rows, '/r/README.md', 'Enter')).toEqual({ type: 'open', entry: readme });
    expect(resolveTreeKey(rows, '/r/src', 'Enter')).toEqual({ type: 'toggle', entry: src });
    expect(resolveTreeKey(rows, '/r/README.md', 'F2')).toEqual({ type: 'rename', entry: readme });
    expect(resolveTreeKey(rows, '/r/README.md', 'Delete')).toEqual({ type: 'delete', entry: readme });
  });

  it('ignores rename/delete/enter with nothing focused, other keys, and empty trees', () => {
    expect(resolveTreeKey(rows, null, 'Enter')).toBeNull();
    expect(resolveTreeKey(rows, null, 'F2')).toBeNull();
    expect(resolveTreeKey(rows, null, 'Delete')).toBeNull();
    expect(resolveTreeKey(rows, '/r/src', 'Tab')).toBeNull();
    expect(resolveTreeKey([], null, 'ArrowDown')).toBeNull();
  });

  it('handles a single row', () => {
    const one = flattenVisibleRows([readme], entries, new Map(), false);
    expect(resolveTreeKey(one, '/r/README.md', 'ArrowDown')).toEqual({ type: 'focus', path: '/r/README.md' });
    expect(resolveTreeKey(one, '/r/README.md', 'ArrowUp')).toEqual({ type: 'focus', path: '/r/README.md' });
  });
});

describe('typeAheadMatch', () => {
  const rows = flattenVisibleRows(rootList, entries, open('/r/src'), false);

  it('finds the next row starting with the prefix, wrapping around', () => {
    expect(typeAheadMatch(rows, null, 'r')).toBe('/r/README.md');
    expect(typeAheadMatch(rows, '/r/README.md', 'r')).toBe('/r/README.md');
    expect(typeAheadMatch(rows, '/r/src', 'a')).toBe('/r/src/app.ts');
  });

  it('keeps the focused row for a growing prefix', () => {
    expect(typeAheadMatch(rows, '/r/src', 'sr')).toBe('/r/src');
  });

  it('returns null for no match, an empty prefix, or no rows', () => {
    expect(typeAheadMatch(rows, null, 'zzz')).toBeNull();
    expect(typeAheadMatch(rows, null, '')).toBeNull();
    expect(typeAheadMatch([], null, 'a')).toBeNull();
  });
});
