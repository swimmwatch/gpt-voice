import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { resolveConfirmationAction } from '@renderer/components/ui/confirmation-dialog';

const ROOT = process.cwd();

function source(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

describe('ConfirmationDialog', () => {
  it('closes only for an explicit successful action and contains rejected work', async () => {
    assert.equal(await resolveConfirmationAction(() => true), true);
    assert.equal(await resolveConfirmationAction(() => false), false);
    assert.equal(
      await resolveConfirmationAction(async () => {
        throw new Error('private failure');
      }),
      false,
    );
  });

  it('uses the shared modal surface and locks duplicate submission and dismissal while pending', () => {
    const confirmation = source('src/renderer/components/ui/confirmation-dialog.tsx');
    const alertDialog = source('src/renderer/components/ui/alert-dialog.tsx');
    const dialog = source('src/renderer/components/ui/dialog.tsx');
    const styles = source('src/renderer/components/ui/modal-styles.ts');

    assert.match(confirmation, /const pendingRef = useRef\(false\);/u);
    assert.match(confirmation, /if \(!nextOpen && pendingRef\.current\) return;/u);
    assert.match(confirmation, /if \(pendingRef\.current\) return;/u);
    assert.match(confirmation, /<AlertDialogCancel asChild>[\s\S]*?<Button disabled=\{pending\} variant="outline">/u);
    assert.match(confirmation, /<Button\s+aria-busy=\{pending \|\| undefined\}[\s\S]*?variant=\{tone\}/u);
    assert.match(confirmation, /disabled:cursor-wait disabled:opacity-100/u);
    assert.doesNotMatch(confirmation, /AlertDialogAction/u);
    for (const modalSource of [alertDialog, dialog]) {
      assert.match(modalSource, /MODAL_CONTENT_CLASS_NAME/u);
      assert.match(modalSource, /MODAL_FOOTER_CLASS_NAME/u);
    }
    assert.match(styles, /bg-surface/u);
    assert.match(styles, /border-border/u);
  });
});
