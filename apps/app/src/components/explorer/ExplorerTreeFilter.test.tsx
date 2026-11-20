// @vitest-environment happy-dom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ExplorerTreeFilter } from './ExplorerTreeFilter.js';
import { ExplorerTreeHeader } from './ExplorerTreeHeader.js';

afterEach(cleanup);

function setup(matchCount: number | null = null) {
  const props = { onChange: vi.fn(), onClose: vi.fn(), onFocusTree: vi.fn() };
  render(<ExplorerTreeFilter query="ab" matchCount={matchCount} {...props} />);
  return { input: screen.getByLabelText('Filter files by name'), ...props };
}

describe('ExplorerTreeFilter', () => {
  it('focuses the input and reports edits', () => {
    const { input, onChange } = setup();
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalledWith('abc');
  });

  it('Escape and the clear button close; Enter and ArrowDown hand focus to the tree', () => {
    const { input, onClose, onFocusTree } = setup();
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.click(screen.getByLabelText('Clear filter'));
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'a' });
    expect(onFocusTree).toHaveBeenCalledTimes(2);
  });

  it('says that only opened folders are searched, with a match count', () => {
    cleanup();
    setup(null);
    expect(screen.getByRole('status').textContent).toContain('opened');
    cleanup();
    setup(1);
    expect(screen.getByRole('status').textContent).toBe('1 match in opened folders.');
    cleanup();
    setup(0);
    expect(screen.getByRole('status').textContent).toBe('0 matches in opened folders.');
  });
});

describe('ExplorerTreeHeader filter button', () => {
  const base = {
    project: { name: 'p', path: '/p' } as never,
    isRemote: false,
    treeMode: 'files' as const,
    changedFilesCount: 0,
    onTreeModeToggle: () => {},
    onCreateFile: () => {},
    onCreateFolder: () => {},
    onRefresh: () => {}
  };

  it('renders only when a handler is given and reflects the active state', () => {
    const { rerender } = render(<ExplorerTreeHeader {...base} />);
    expect(screen.queryByLabelText('Filter files')).toBeNull();
    const onToggleFilter = vi.fn();
    rerender(<ExplorerTreeHeader {...base} onToggleFilter={onToggleFilter} filterActive />);
    const button = screen.getByLabelText('Filter files');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button);
    expect(onToggleFilter).toHaveBeenCalled();
  });
});
