import {
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
} from '../google-sheet/models.js';
import { getSettingValue, setSettingValue } from './settingsService.js';
import { ApiError } from '../utils/response.js';

// Every list section is one row per item in its own sheet, ordered by an
// explicit sort_order column (Sheets rows have no reliable persisted order
// once rows are deleted/reinserted). New inserts land after the current
// max with a gap of 10, so an admin can later drag an item between two
// existing ones without renumbering the whole sheet.
export const SECTIONS = {
  'nav-links': NavLinksRepo,
  'ink-swatches': InkSwatchesRepo,
  'hero-stats': HeroStatsRepo,
  'hero-slides': HeroSlidesRepo,
  clients: ClientsRepo,
  services: CmsServicesRepo,
  projects: CmsProjectsRepo,
  steps: CmsStepsRepo,
  'stats-band': StatsBandRepo,
  faqs: FaqsRepo,
};

function clean(record) {
  const { _rowNumber, sort_order, ...rest } = record;
  return rest;
}

function getRepo(section) {
  const repo = SECTIONS[section];
  if (!repo) throw new ApiError(404, 'Section tidak ditemukan');
  return repo;
}

export async function listSection(section) {
  const repo = getRepo(section);
  const rows = await repo.getAll();
  return rows.sort((a, b) => Number(a.sort_order) - Number(b.sort_order)).map(clean);
}

export async function createItem(section, data) {
  const repo = getRepo(section);
  const rows = await repo.getAll({ fresh: true });
  const maxOrder = rows.reduce((max, r) => Math.max(max, Number(r.sort_order) || 0), 0);
  const created = await repo.insert({ ...data, sort_order: maxOrder + 10 });
  return clean(created);
}

export async function updateItem(section, id, patch) {
  const repo = getRepo(section);
  const updated = await repo.updateById(id, patch);
  if (!updated) throw new ApiError(404, 'Item tidak ditemukan');
  return clean(updated);
}

export async function deleteItem(section, id) {
  const repo = getRepo(section);
  const deleted = await repo.deleteById(id);
  if (!deleted) throw new ApiError(404, 'Item tidak ditemukan');
}

// orderedIds is the full list of ids for this section in their new display
// order — assigns sort_order = 10, 20, 30... by position, same gap
// convention as createItem.
export async function reorderSection(section, orderedIds) {
  const repo = getRepo(section);
  const rows = await repo.getAll({ fresh: true });
  const validIds = new Set(rows.map((r) => String(r.id)));
  for (const id of orderedIds) {
    if (!validIds.has(String(id))) throw new ApiError(400, `Item tidak valid: ${id}`);
  }
  if (orderedIds.length !== rows.length) {
    throw new ApiError(400, 'orderedIds harus mencakup semua item di section ini');
  }

  let sortOrder = 10;
  for (const id of orderedIds) {
    await repo.updateById(id, { sort_order: sortOrder });
    sortOrder += 10;
  }
  return listSection(section);
}

// --- Scalar/singleton sections (stored as AppSettings key/value rows) ---

export async function getGeneralSettings() {
  const [waPhone, waMessage, formEndpoint] = await Promise.all([
    getSettingValue('cms_wa_phone'),
    getSettingValue('cms_wa_default_message'),
    getSettingValue('cms_form_endpoint'),
  ]);
  return { wa_phone: waPhone, wa_default_message: waMessage, form_endpoint: formEndpoint };
}

export async function updateGeneralSettings({ wa_phone, wa_default_message, form_endpoint }) {
  if (wa_phone !== undefined) await setSettingValue('cms_wa_phone', wa_phone);
  if (wa_default_message !== undefined) await setSettingValue('cms_wa_default_message', wa_default_message);
  if (form_endpoint !== undefined) await setSettingValue('cms_form_endpoint', form_endpoint);
  return getGeneralSettings();
}

export async function getFoundersPromise() {
  const [quote, name, role] = await Promise.all([
    getSettingValue('cms_founder_quote'),
    getSettingValue('cms_founder_name'),
    getSettingValue('cms_founder_role'),
  ]);
  return { quote, name, role };
}

export async function updateFoundersPromise({ quote, name, role }) {
  if (quote !== undefined) await setSettingValue('cms_founder_quote', quote);
  if (name !== undefined) await setSettingValue('cms_founder_name', name);
  if (role !== undefined) await setSettingValue('cms_founder_role', role);
  return getFoundersPromise();
}

export async function getContactInfo() {
  const [address, phone, email, hours, mapEmbed] = await Promise.all([
    getSettingValue('cms_contact_address'),
    getSettingValue('cms_contact_phone'),
    getSettingValue('cms_contact_email'),
    getSettingValue('cms_contact_hours'),
    getSettingValue('cms_contact_map_embed'),
  ]);
  return {
    address,
    phone,
    email,
    hours: hours ? hours.split('\n') : [],
    map_embed: mapEmbed,
  };
}

export async function updateContactInfo({ address, phone, email, hours, map_embed }) {
  if (address !== undefined) await setSettingValue('cms_contact_address', address);
  if (phone !== undefined) await setSettingValue('cms_contact_phone', phone);
  if (email !== undefined) await setSettingValue('cms_contact_email', email);
  if (hours !== undefined) await setSettingValue('cms_contact_hours', hours.join('\n'));
  if (map_embed !== undefined) await setSettingValue('cms_contact_map_embed', map_embed);
  return getContactInfo();
}

// --- Public, read-only assembled payload (GET /api/public/cms/content) ---

export async function getPublicCmsContent() {
  const [
    navLinks,
    inkSwatches,
    heroStats,
    heroSlides,
    clients,
    services,
    projects,
    steps,
    statsBand,
    faqs,
    general,
    foundersPromise,
    contactInfo,
  ] = await Promise.all([
    listSection('nav-links'),
    listSection('ink-swatches'),
    listSection('hero-stats'),
    listSection('hero-slides'),
    listSection('clients'),
    listSection('services'),
    listSection('projects'),
    listSection('steps'),
    listSection('stats-band'),
    listSection('faqs'),
    getGeneralSettings(),
    getFoundersPromise(),
    getContactInfo(),
  ]);

  return {
    waPhone: general.wa_phone,
    waLink: `https://api.whatsapp.com/send?phone=${general.wa_phone}&text=${encodeURIComponent(general.wa_default_message)}`,
    navLinks: navLinks.map((n) => ({ href: n.href, label: n.label })),
    inkSwatches: inkSwatches.map((s) => ({ code: s.code, name: s.name, var: s.css_var })),
    heroStats: heroStats.map((s) => ({ label: s.label, value: s.value })),
    heroSlides: heroSlides.map((s) => ({ image: s.image_url, alt: s.alt })),
    clients: clients.map((c) => ({ name: c.name, logo: c.logo_url })),
    foundersPromise,
    services: services.map((s) => ({
      icon: s.icon,
      swatch: s.css_var,
      title: s.title,
      description: s.description,
      points: s.points ? s.points.split('|') : [],
    })),
    projects: projects.map((p) => ({ title: p.title, description: p.description, image: p.image_url })),
    steps: steps.map((s) => ({ stage: s.stage, title: s.title, description: s.description })),
    statsBand: statsBand.map((s) => ({
      value: Number(s.value),
      prefix: s.prefix,
      suffix: s.suffix,
      label: s.label,
    })),
    faqs: faqs.map((f) => ({ q: f.question, a: f.answer })),
    contactInfo: {
      address: contactInfo.address,
      phone: contactInfo.phone,
      email: contactInfo.email,
      hours: contactInfo.hours,
      mapEmbed: contactInfo.map_embed,
    },
    formEndpoint: general.form_endpoint,
  };
}
