import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const rootDirectory = path.resolve(__dirname, '../..');
const uiDirectory = path.join(rootDirectory, 'src/landing-page/components/ui');

test('keeps landing action primitives semantic and token-bound', async () => {
  const [badge, button] = await Promise.all([
    readFile(path.join(uiDirectory, 'badge.tsx'), 'utf8'),
    readFile(path.join(uiDirectory, 'button.tsx'), 'utf8'),
  ]);

  assert.match(button, /const Comp = asChild \? Slot : 'button';/);
  assert.match(button, /type = 'button'/);
  assert.match(button, /default: 'bg-primary/);
  assert.match(button, /ghost: 'bg-transparent/);
  assert.match(button, /icon: 'bg-transparent/);
  assert.match(button, /outline: 'border-border/);
  assert.match(button, /focus-visible:shadow-\[var\(--shadow-focus\)\]/);
  assert.match(button, /icon: 'size-11 p-0'/);
  assert.match(badge, /const Comp = asChild \? Slot : 'span';/);
  assert.match(badge, /secondary: 'border-border bg-secondary/);
  assert.match(badge, /outline: 'border-border bg-transparent/);
});

test('keeps landing cards static presentation surfaces', async () => {
  const card = await readFile(path.join(uiDirectory, 'card.tsx'), 'utf8');

  assert.match(card, /<div/);
  assert.match(card, /rounded-\[var\(--radius-card\)\]/);
  assert.match(card, /shadow-\[var\(--shadow-card\)\]/);
  assert.doesNotMatch(card, /cursor-pointer|hover:|tabIndex|role=/);
});
