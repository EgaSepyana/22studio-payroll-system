import bcrypt from 'bcryptjs';
import { getSheetsClient, SPREADSHEET_ID } from './sheetClient.js';
import {
  SHEET_SCHEMAS,
  UsersRepo,
  EmployeesRepo,
  WATemplatesRepo,
  WA_TEMPLATE_DEFAULTS,
  AppSettingsRepo,
  NavLinksRepo,
  InkSwatchesRepo,
  HeroStatsRepo,
  HeroSlidesRepo,
  ClientsRepo,
  CmsServicesRepo,
  CmsProjectsRepo,
  CmsStepsRepo,
  StatsBandRepo,
  FaqsRepo,
  CMS_SEED_DATA,
} from './models.js';

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

// Standalone Produksi-scoped admin account, same shape as seedAdmin() —
// not tied to an Employees row. Grants full CRUD on Order/Task/Surat Jalan/
// Lembar PO/Kalender Produksi only (see requireRole('admin', 'admin_produksi')
// across those route files), nothing else.
async function seedAdminProduksi() {
  const existingUsers = await UsersRepo.getAll({ fresh: true });
  if (existingUsers.some((u) => u.username === 'admin_produksi')) {
    console.log('admin_produksi user already exists, skipping seed.');
    return;
  }
  const passwordHash = await bcrypt.hash('admin123', 10);
  await UsersRepo.insert({
    username: 'admin_produksi',
    password: passwordHash,
    role: 'admin_produksi',
    employee_id: '',
  });
  console.log('Seeded admin_produksi user -> username: admin_produksi / password: admin123');
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

// One repo per CMS list section, paired with its seed data and the
// sort_order gap (10, 20, 30...) each row is assigned on first seed — lets
// an admin insert an item between two existing ones later without
// renumbering the whole sheet.
const CMS_LIST_SECTIONS = [
  { repo: NavLinksRepo, items: CMS_SEED_DATA.navLinks },
  { repo: InkSwatchesRepo, items: CMS_SEED_DATA.inkSwatches },
  { repo: HeroStatsRepo, items: CMS_SEED_DATA.heroStats },
  { repo: HeroSlidesRepo, items: CMS_SEED_DATA.heroSlides },
  { repo: ClientsRepo, items: CMS_SEED_DATA.clients },
  { repo: CmsServicesRepo, items: CMS_SEED_DATA.services.map((s) => ({ ...s, points: s.points.join('|') })) },
  { repo: CmsProjectsRepo, items: CMS_SEED_DATA.projects },
  { repo: CmsStepsRepo, items: CMS_SEED_DATA.steps },
  { repo: StatsBandRepo, items: CMS_SEED_DATA.statsBand },
  { repo: FaqsRepo, items: CMS_SEED_DATA.faqs },
];

async function seedCmsContent() {
  for (const { repo, items } of CMS_LIST_SECTIONS) {
    const existing = await repo.getAll({ fresh: true });
    if (existing.length > 0) {
      console.log(`${repo.sheetName} already seeded, skipping.`);
      continue;
    }
    let sortOrder = 10;
    for (const item of items) {
      await repo.insert({ ...item, sort_order: sortOrder });
      sortOrder += 10;
    }
    console.log(`Seeded ${items.length} row(s) into ${repo.sheetName}.`);
  }

  const existingSettings = await AppSettingsRepo.getAll({ fresh: true });
  const existingKeys = new Set(existingSettings.map((s) => s.key));
  const scalarDefaults = {
    ...CMS_SEED_DATA.general,
    ...CMS_SEED_DATA.foundersPromise,
    ...CMS_SEED_DATA.contactInfo,
  };
  let seededScalars = 0;
  for (const [key, value] of Object.entries(scalarDefaults)) {
    if (existingKeys.has(key)) continue;
    await AppSettingsRepo.insert({ key, value });
    seededScalars += 1;
  }
  if (seededScalars > 0) console.log(`Seeded ${seededScalars} CMS setting(s) into AppSettings.`);
  else console.log('CMS settings already seeded, skipping.');
}

async function main() {
  await ensureSheets();
  await seedAdmin();
  await seedAdminProduksi();
  await seedWATemplates();
  await seedCmsContent();
  console.log('Google Sheets setup complete.');
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
