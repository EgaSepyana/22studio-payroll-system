import './helpers/testEnv.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

const { default: app } = await import('../app.js');

test('GET /api/health responds OK without touching Google Sheets', async () => {
  const server = app.listen(0);
  await once(server, 'listening');
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { success: true, message: 'OK' });
  } finally {
    server.close();
  }
});
