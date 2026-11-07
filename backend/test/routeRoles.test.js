import './helpers/testEnv.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installMountPathRecorder, snapshotRouteGuards } from './helpers/routeWalker.js';

installMountPathRecorder();
const { default: app } = await import('../app.js');

const fixture = JSON.parse(readFileSync(new URL('./fixtures/route-roles.json', import.meta.url), 'utf8'));
const current = JSON.parse(JSON.stringify(snapshotRouteGuards(app)));

// Human route guards must not change unintentionally. After an intentional
// change, regenerate with `npm run snapshot:route-roles` and review the diff.
test('human route guards match the committed snapshot', () => {
  assert.deepEqual(current, fixture);
});

test('every route is either public or declares authentication', () => {
  for (const [key, guard] of Object.entries(current)) {
    if (guard.auth === 'none') {
      assert.equal(guard.roles, null, `${key} is public but declares roles`);
    }
  }
});
