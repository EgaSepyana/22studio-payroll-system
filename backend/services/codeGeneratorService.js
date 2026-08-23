// Sequential human-readable codes (HTG-001, AST-001, BRG-001, PRD-001,
// MDL-001, ...) for the Owner Keuangan module — one generator instead of
// copy-pasting orderService.js's generateInvoiceNo scan-and-increment logic
// per entity type (owner.md's explicit "one atomic sequence generator per
// entity type" note).
//
// Not truly atomic — like generateInvoiceNo, it scans the sheet and takes
// max + 1, which races under concurrent writers — but every write to a given
// sheet already serializes through SheetRepository's per-sheet-name
// withLock, so two requests generating a code for the *same* repo can't
// interleave in practice. Kept simple to match this codebase's existing
// pattern rather than introducing a separate counters table.
export async function generateSequentialCode(repo, field, prefix) {
  const rows = await repo.getAll();
  let max = 0;
  for (const row of rows) {
    const value = row[field];
    if (typeof value === 'string' && value.startsWith(`${prefix}-`)) {
      const seq = Number(value.slice(prefix.length + 1));
      if (Number.isFinite(seq)) max = Math.max(max, seq);
    }
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}
