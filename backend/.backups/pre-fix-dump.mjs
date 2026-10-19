import { PayrollRepo } from '../google-sheet/models.js';
import fs from 'node:fs';

const all = await PayrollRepo.getAll({ fresh: true });
const dini = all.find((r) => r._rowNumber === 467);
const budi = all.find((r) => r._rowNumber === 468);

const snapshot = {
  takenAt: new Date().toISOString(),
  note: 'Snapshot before fixing duplicate Payroll id=528 (Dini row467 vs Budi row468). Restore by writing these exact values back to their row/col if the fix needs to be reverted.',
  rows: { dini_row467: dini, budi_row468: budi },
};

fs.writeFileSync(
  new URL(`./snapshot-${Date.now()}.json`, import.meta.url),
  JSON.stringify(snapshot, null, 2)
);
console.log(JSON.stringify(snapshot, null, 2));
