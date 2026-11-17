import '../test/helpers/testEnv.js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { installMountPathRecorder, snapshotRouteGuards } from '../test/helpers/routeWalker.js';

installMountPathRecorder();
const { default: app } = await import('../app.js');

const target = fileURLToPath(new URL('../test/fixtures/route-roles.json', import.meta.url));
const snapshot = snapshotRouteGuards(app);
writeFileSync(target, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Wrote ${Object.keys(snapshot).length} routes to ${target}`);
