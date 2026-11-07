import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasYesFlag, confirmSheetWrite } from '../google-sheet/writeGuard.js';

function setup(argv) {
  const logs = [];
  const fetched = [];
  const fetchTitle = async (id) => {
    fetched.push(id);
    return 'Payroll DEV';
  };
  return { logs, fetched, run: () => confirmSheetWrite({ argv, spreadsheetId: 'sheet-1', fetchTitle, log: (m) => logs.push(m) }) };
}

test('hasYesFlag only matches an exact --yes', () => {
  assert.equal(hasYesFlag(['--yes']), true);
  assert.equal(hasYesFlag(['--force', '--yes']), true);
  assert.equal(hasYesFlag([]), false);
  assert.equal(hasYesFlag(['--yes=false', 'yes', '-y']), false);
});

test('without --yes: prints the title, refuses to proceed', async () => {
  const { logs, fetched, run } = setup([]);
  assert.equal(await run(), false);
  assert.deepEqual(fetched, ['sheet-1']);
  assert.ok(logs.some((l) => l.includes('Payroll DEV')));
});

test('with --yes: prints the title, then proceeds', async () => {
  const { logs, run } = setup(['--yes']);
  assert.equal(await run(), true);
  assert.ok(logs.some((l) => l.includes('Payroll DEV')));
});

test('if the title cannot be fetched, the guard throws instead of proceeding', async () => {
  const fetchTitle = async () => {
    throw new Error('boom');
  };
  await assert.rejects(confirmSheetWrite({ argv: ['--yes'], spreadsheetId: 'x', fetchTitle, log() {} }), /boom/);
});
