import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { FsEntry } from '@zana-ai/zcc-domain/product';
import { resolveTreeKey, typeAheadMatch, type VisibleRow } from './tree-keyboard.js';

const TYPE_AHEAD_RESET_MS = 700;
const FOCUS_CLASS = 'kbd-focus';

interface Options {
  rows: VisibleRow[];
  bodyRef: React.RefObject<HTMLElement | null>;
  onToggle: (entry: FsEntry) => void;
  onOpenFile: (entry: FsEntry) => void;
  onRename: (entry: FsEntry) => void;
  onDelete: (entry: FsEntry) => void;
}

/**
 * Keyboard model for the Explorer tree (aria-activedescendant style): the tree
 * body holds DOM focus and the "current" row is tracked here. The marker class
 * is applied straight to the DOM so moving focus never re-renders the
 * memoised TreeList.
 */
export function useTreeKeyboard({ rows, bodyRef, onToggle, onOpenFile, onRename, onDelete }: Options) {
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const buffer = useRef({ text: '', timer: 0 as unknown as ReturnType<typeof setTimeout> });

  // Drop the focused row if it disappears (collapsed parent, refresh, delete).
  const focusedVisible = focusedPath !== null && rows.some((row) => row.path === focusedPath);
  useEffect(() => {
    if (focusedPath !== null && !focusedVisible) setFocusedPath(null);
  }, [focusedPath, focusedVisible]);

  // Re-applied after every render because React may rewrite a row's className.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    for (const el of body.querySelectorAll(`.${FOCUS_CLASS}`)) el.classList.remove(FOCUS_CLASS);
    if (focusedPath === null) {
      body.removeAttribute('aria-activedescendant');
      return;
    }
    const row = [...body.querySelectorAll<HTMLElement>('.tree-row[data-path]')]
      .find((el) => el.dataset.path === focusedPath);
    if (!row) return;
    row.classList.add(FOCUS_CLASS);
    if (row.id) body.setAttribute('aria-activedescendant', row.id);
    row.scrollIntoView?.({ block: 'nearest' });
  });

  useEffect(() => () => clearTimeout(buffer.current.timer), []);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    // Only the tree itself drives navigation; inputs, menus and modals keep their keys.
    if (e.target !== e.currentTarget) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const printable = e.key.length === 1 && e.key !== ' ';
    if (printable) {
      const b = buffer.current;
      clearTimeout(b.timer);
      b.text += e.key;
      b.timer = setTimeout(() => { b.text = ''; }, TYPE_AHEAD_RESET_MS);
      const match = typeAheadMatch(rows, focusedPath, b.text);
      if (match) {
        e.preventDefault();
        setFocusedPath(match);
      }
      return;
    }
    const action = resolveTreeKey(rows, focusedPath, e.key);
    if (!action) return;
    e.preventDefault();
    switch (action.type) {
      case 'focus': setFocusedPath(action.path); break;
      case 'toggle': onToggle(action.entry); break;
      case 'open': onOpenFile(action.entry); break;
      case 'rename': onRename(action.entry); break;
      case 'delete': onDelete(action.entry); break;
    }
  }, [rows, focusedPath, onToggle, onOpenFile, onRename, onDelete]);

  // Clicking a row makes it the keyboard-current row.
  const onClickCapture = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.tree-row[data-path]');
    if (row?.dataset.path) setFocusedPath(row.dataset.path);
  }, []);

  return { onKeyDown, onClickCapture, focusedPath };
}
