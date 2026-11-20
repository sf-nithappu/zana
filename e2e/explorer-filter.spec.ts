import { test, expect } from './fixtures/app.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

test.use({ e2e: true, initialConfig: { sponsorPromptDismissed: true } });

test('Explorer filters opened folders by name and restores the tree on clear', async ({ app, home }) => {
  const { window } = app;
  const root = join(home, 'explorer filter');
  mkdirSync(join(root, 'src', 'lib'), { recursive: true });
  mkdirSync(join(root, 'docs'));
  writeFileSync(join(root, 'src', 'lib', 'needle.ts'), 'export const n = 1;\n');
  writeFileSync(join(root, 'src', 'app.ts'), 'export const a = 1;\n');
  writeFileSync(join(root, 'docs', 'guide.md'), '# Guide\n');
  await window.evaluate(async path => {
    const result = await window.cc.projects.add(path);
    if (!result.ok) throw new Error(result.message);
  }, root);

  const heading = window.getByTestId('sidebar-projects-heading');
  if (await heading.getAttribute('aria-expanded') === 'false') await heading.click();
  await window.getByRole('button', { name: 'Open explorer filter', exact: true }).click();
  await window.getByTestId('project-nav-explorer').click();

  const row = (name: string) => window.locator(`.tree-row[data-path$="/${name}"]`);
  await row('src').click();
  await row('lib').click();
  await expect(row('needle.ts')).toBeVisible();
  await row('src').click(); // collapse: the filter must still find loaded descendants

  await window.getByRole('button', { name: 'Filter files', exact: true }).click();
  await window.getByLabel('Filter files by name').fill('needle');
  await expect(row('needle.ts')).toBeVisible();
  await expect(row('app.ts')).toHaveCount(0);
  await expect(row('docs')).toHaveCount(0);
  await expect(window.getByRole('status').filter({ hasText: '1 match' })).toBeVisible();

  await window.getByLabel('Filter files by name').fill('zzz-no-such');
  await expect(window.getByText('No matching files in opened folders.')).toBeVisible();

  await window.keyboard.press('Escape');
  await expect(window.getByLabel('Filter files by name')).toHaveCount(0);
  await expect(row('docs')).toBeVisible();
  await expect(row('needle.ts')).toHaveCount(0); // src is collapsed again, as before filtering
});
