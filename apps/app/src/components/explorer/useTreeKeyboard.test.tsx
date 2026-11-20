// @vitest-environment happy-dom
import React, { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { FsEntry } from '@zana-ai/zcc-domain/product';
import { flattenVisibleRows } from './tree-keyboard.js';
import { useTreeKeyboard } from './useTreeKeyboard.js';

afterEach(() => { cleanup(); vi.useRealTimers(); });

const dir = (path: string): FsEntry => ({ name: path.split('/').pop()!, kind: 'dir', path });
const file = (path: string): FsEntry => ({ name: path.split('/').pop()!, kind: 'file', path });
const src = dir('/r/src');
const readme = file('/r/README.md');
const notes = file('/r/notes.md');

function Harness({ list, handlers }: { list: FsEntry[]; handlers: Record<string, (e: FsEntry) => void> }) {
  const ref = useRef<HTMLDivElement>(null);
  const rows = flattenVisibleRows(list, new Map(), new Map(), false);
  const kb = useTreeKeyboard({
    rows,
    bodyRef: ref,
    onToggle: handlers.toggle!,
    onOpenFile: handlers.open!,
    onRename: handlers.rename!,
    onDelete: handlers.delete!
  });
  return (
    <div ref={ref} role="tree" tabIndex={0} data-testid="tree" onKeyDown={kb.onKeyDown} onClickCapture={kb.onClickCapture}>
      {list.map((e) => (
        <div key={e.path} className="tree-row" id={`row-${e.name}`} data-path={e.path}>
          <input aria-label={`in-${e.name}`} />
          {e.name}
        </div>
      ))}
    </div>
  );
}

function setup(list = [src, readme, notes]) {
  const handlers = { toggle: vi.fn(), open: vi.fn(), rename: vi.fn(), delete: vi.fn() };
  const utils = render(<Harness list={list} handlers={handlers} />);
  const tree = utils.getByTestId('tree');
  const focused = () => [...tree.querySelectorAll('.kbd-focus')].map((el) => (el as HTMLElement).dataset.path);
  return { ...utils, tree, handlers, focused };
}

describe('useTreeKeyboard', () => {
  it('moves the marker with arrows and reports aria-activedescendant', () => {
    const { tree, focused } = setup();
    fireEvent.keyDown(tree, { key: 'ArrowDown' });
    expect(focused()).toEqual(['/r/src']);
    fireEvent.keyDown(tree, { key: 'ArrowDown' });
    expect(focused()).toEqual(['/r/README.md']);
    expect(tree.getAttribute('aria-activedescendant')).toBe('row-README.md');
  });

  it('dispatches Enter, F2 and Delete for the current row', () => {
    const { tree, handlers } = setup();
    fireEvent.keyDown(tree, { key: 'ArrowDown' });
    fireEvent.keyDown(tree, { key: 'Enter' });
    expect(handlers.toggle).toHaveBeenCalledWith(src);
    fireEvent.keyDown(tree, { key: 'ArrowDown' });
    fireEvent.keyDown(tree, { key: 'Enter' });
    expect(handlers.open).toHaveBeenCalledWith(readme);
    fireEvent.keyDown(tree, { key: 'F2' });
    expect(handlers.rename).toHaveBeenCalledWith(readme);
    fireEvent.keyDown(tree, { key: 'Delete' });
    expect(handlers.delete).toHaveBeenCalledWith(readme);
  });

  it('clicking a row makes it current', () => {
    const { tree, getByText, focused } = setup();
    fireEvent.click(getByText('notes.md'));
    expect(focused()).toEqual(['/r/notes.md']);
    fireEvent.keyDown(tree, { key: 'ArrowUp' });
    expect(focused()).toEqual(['/r/README.md']);
  });

  it('type-ahead jumps by name and resets after a pause', () => {
    vi.useFakeTimers();
    const { tree, focused } = setup();
    fireEvent.keyDown(tree, { key: 'n' });
    expect(focused()).toEqual(['/r/notes.md']);
    vi.advanceTimersByTime(800);
    fireEvent.keyDown(tree, { key: 'r' });
    expect(focused()).toEqual(['/r/README.md']);
    fireEvent.keyDown(tree, { key: 'q' });
    expect(focused()).toEqual(['/r/README.md']);
  });

  it('ignores keys from inner controls and modified keys', () => {
    const { tree, getByLabelText, focused, handlers } = setup();
    fireEvent.keyDown(getByLabelText('in-src'), { key: 'ArrowDown' });
    fireEvent.keyDown(tree, { key: 'ArrowDown', metaKey: true });
    fireEvent.keyDown(tree, { key: 'Delete', ctrlKey: true });
    expect(focused()).toEqual([]);
    expect(handlers.delete).not.toHaveBeenCalled();
  });

  it('clears the marker when the focused row disappears', () => {
    const handlers = { toggle: vi.fn(), open: vi.fn(), rename: vi.fn(), delete: vi.fn() };
    const { getByTestId, rerender } = render(<Harness list={[src, readme]} handlers={handlers} />);
    const tree = getByTestId('tree');
    fireEvent.keyDown(tree, { key: 'End' });
    expect(tree.querySelector('.kbd-focus')?.getAttribute('data-path')).toBe('/r/README.md');
    rerender(<Harness list={[src]} handlers={handlers} />);
    expect(tree.querySelector('.kbd-focus')).toBeNull();
    expect(tree.hasAttribute('aria-activedescendant')).toBe(false);
  });
});
