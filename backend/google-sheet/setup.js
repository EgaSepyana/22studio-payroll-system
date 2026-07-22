import bcrypt from 'bcryptjs';
import { getSheetsClient, SPREADSHEET_ID } from './sheetClient.js';
import { SHEET_SCHEMAS, UsersRepo, EmployeesRepo, WATemplatesRepo, WA_TEMPLATE_DEFAULTS } from './models.js';

async function ensureSheets() {
  const sheets = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existingTitles = meta.data.sheets.map((s) => s.properties.title);

  const wanted = Object.keys(SHEET_SCHEMAS);
  const toCreate = wanted.filter((name) => !existingTitles.includes(name));

  if (toCreate.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: toCreate.map((title) => ({ addSheet: { properties: { title } } })),
      },
    });
    console.log('Created sheets:', toCreate.join(', '));
  }

  // Write header rows (idempotent — safe to re-run).
  const data = wanted.map((name) => ({
    range: `${name}!A1:${String.fromCharCode(64 + SHEET_SCHEMAS[name].length)}1`,
    values: [SHEET_SCHEMAS[name]],
  }));

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: 'RAW', data },
  });
  console.log('Header rows written.');

  // Remove default empty "Sheet1" if it's still around and unused.
  const refreshed = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet1 = refreshed.data.sheets.find((s) => s.properties.title === 'Sheet1');
  if (sheet1) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ deleteSheet: { sheetId: sheet1.properties.sheetId } }],
      },
    });
    console.log('Removed default Sheet1.');
  }
}

async function seedAdmin() {
  const existingUsers = await UsersRepo.getAll({ fresh: true });
  if (existingUsers.some((u) => u.username === 'admin')) {
    console.log('Admin user already exists, skipping seed.');
    return;
  }
  const passwordHash = await bcrypt.hash('admin123', 10);
  await UsersRepo.insert({
    username: 'admin',
    password: passwordHash,
    role: 'admin',
    employee_id: '',
  });
  console.log('Seeded admin user -> username: admin / password: admin123');
}

async function seedWATemplates() {
  const existing = await WATemplatesRepo.getAll({ fresh: true });
  const existingKeys = new Set(existing.map((t) => t.template_key));
  const missing = WA_TEMPLATE_DEFAULTS.filter((t) => !existingKeys.has(t.template_key));
  if (missing.length === 0) {
    console.log('WA templates already seeded, skipping.');
    return;
  }
  for (const tpl of missing) {
    await WATemplatesRepo.insert(tpl);
  }
  console.log(`Seeded ${missing.length} WA template(s).`);
}

async function main() {
  await ensureSheets();
  await seedAdmin();
  await seedWATemplates();
  console.log('Google Sheets setup complete.');
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
