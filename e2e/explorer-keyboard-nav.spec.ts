import { test, expect } from './fixtures/app.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

test.use({ e2e: true, initialConfig: { sponsorPromptDismissed: true } });

test('Explorer tree is navigable and operable from the keyboard', async ({ app, home }) => {
  const { window } = app;
  const root = join(home, 'explorer keyboard');
  mkdirSync(join(root, 'alpha'), { recursive: true });
  mkdirSync(join(root, 'beta'));
  writeFileSync(join(root, 'alpha', 'one.md'), '# One\n');
  writeFileSync(join(root, 'beta', 'two.md'), '# Two\n');
  writeFileSync(join(root, 'zeta.md'), '# Zeta\n');
  await window.evaluate(async path => {
    const result = await window.cc.projects.add(path);
    if (!result.ok) throw new Error(result.message);
  }, root);

  const heading = window.getByTestId('sidebar-projects-heading');
  if (await heading.getAttribute('aria-expanded') === 'false') await heading.click();
  await window.getByRole('button', { name: 'Open explorer keyboard', exact: true }).click();
  await window.getByTestId('project-nav-explorer').click();

  const row = (name: string) => window.locator(`.tree-row[data-path$="/${name}"]`);
  const tree = window.getByRole('tree', { name: 'Files' });
  await expect(row('alpha')).toBeVisible();

  await tree.focus();
  // Hidden folders may sort first, so land on alpha with type-ahead, then step with arrows.
  await window.keyboard.type('a');
  await expect(row('alpha')).toHaveClass(/kbd-focus/);
  await window.keyboard.press('ArrowDown');
  await expect(row('alpha')).not.toHaveClass(/kbd-focus/);
  await window.keyboard.press('ArrowUp');
  await expect(row('alpha')).toHaveClass(/kbd-focus/);

  // Right expands, Right again enters, Down moves within, Left returns to the parent.
  await window.keyboard.press('ArrowRight');
  await expect(row('one.md')).toBeVisible();
  await expect(row('alpha')).toHaveAttribute('aria-expanded', 'true');
  await window.keyboard.press('ArrowRight');
  await expect(row('one.md')).toHaveClass(/kbd-focus/);
  await window.keyboard.press('ArrowLeft');
  await expect(row('alpha')).toHaveClass(/kbd-focus/);
  await window.keyboard.press('ArrowLeft');
  await expect(row('one.md')).toHaveCount(0);

  // Type-ahead jumps to zeta.md; Enter opens it in the viewer.
  await window.waitForTimeout(800); // let the type-ahead buffer reset
  await window.keyboard.type('z');
  await expect(row('zeta.md')).toHaveClass(/kbd-focus/);
  await window.keyboard.press('Enter');
  await expect(row('zeta.md')).toHaveAttribute('aria-current', 'true');

  // F2 opens the rename prompt for the focused row.
  await window.keyboard.press('F2');
  await expect(window.getByRole('dialog')).toBeVisible();
  await window.keyboard.press('Escape');
});
