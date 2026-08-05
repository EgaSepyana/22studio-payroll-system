import { z } from 'zod';
import * as cmsService from '../services/cmsService.js';
import { CMS_SERVICE_ICONS, CMS_CSS_VARS, CMS_INK_CSS_VARS } from '../google-sheet/models.js';
import { ok, created } from '../utils/response.js';

const noPipe = (label) => z.string().refine((v) => !v.includes('|'), { message: `${label} tidak boleh mengandung karakter "|"` });

// One zod schema pair (create = required, update = same fields optional)
// per list section — every section has a genuinely different shape, so
// there is no useful generic schema to factor out here.
const SECTION_SCHEMAS = {
  'nav-links': z.object({ href: z.string().min(1), label: z.string().min(1) }),
  'ink-swatches': z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    css_var: z.enum(CMS_INK_CSS_VARS),
  }),
  'hero-stats': z.object({ label: z.string().min(1), value: z.string().min(1) }),
  'hero-slides': z.object({ image_url: z.string().min(1), alt: z.string().min(1) }),
  clients: z.object({ name: z.string().min(1), logo_url: z.string().min(1) }),
  services: z.object({
    icon: z.enum(CMS_SERVICE_ICONS),
    css_var: z.enum(CMS_CSS_VARS),
    title: z.string().min(1),
    description: z.string().min(1),
    points: z.array(noPipe('Point')).length(3),
  }),
  projects: z.object({ title: z.string().min(1), description: z.string().min(1), image_url: z.string().min(1) }),
  steps: z.object({ stage: z.string().min(1), title: z.string().min(1), description: z.string().min(1) }),
  'stats-band': z.object({
    value: z.union([z.string(), z.number()]),
    prefix: z.string(),
    suffix: z.string(),
    label: z.string().min(1),
  }),
  faqs: z.object({ question: z.string().min(1), answer: z.string().min(1) }),
};

const reorderSchema = z.object({ orderedIds: z.array(z.union([z.string(), z.number()])) });

function toRow(section, data) {
  if (section === 'services') return { ...data, points: data.points.join('|') };
  return data;
}

export async function list(req, res, next) {
  try {
    ok(res, await cmsService.listSection(req.params.section));
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const { section } = req.params;
    const schema = SECTION_SCHEMAS[section];
    if (!schema) return next(new Error('Section tidak dikenal'));
    const data = schema.parse(req.body);
    created(res, await cmsService.createItem(section, toRow(section, data)));
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const { section, id } = req.params;
    const schema = SECTION_SCHEMAS[section];
    if (!schema) return next(new Error('Section tidak dikenal'));
    const data = schema.partial().parse(req.body);
    ok(res, await cmsService.updateItem(section, id, toRow(section, data)));
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await cmsService.deleteItem(req.params.section, req.params.id);
    ok(res, { message: 'Item dihapus' });
  } catch (err) {
    next(err);
  }
}

export async function reorder(req, res, next) {
  try {
    const { orderedIds } = reorderSchema.parse(req.body);
    ok(res, await cmsService.reorderSection(req.params.section, orderedIds));
  } catch (err) {
    next(err);
  }
}

const generalSchema = z.object({
  wa_phone: z.string().min(1).optional(),
  wa_default_message: z.string().optional(),
  form_endpoint: z.string().optional(),
});

export async function getGeneral(req, res, next) {
  try {
    ok(res, await cmsService.getGeneralSettings());
  } catch (err) {
    next(err);
  }
}

export async function updateGeneral(req, res, next) {
  try {
    ok(res, await cmsService.updateGeneralSettings(generalSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

const foundersPromiseSchema = z.object({
  quote: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
});

export async function getFoundersPromise(req, res, next) {
  try {
    ok(res, await cmsService.getFoundersPromise());
  } catch (err) {
    next(err);
  }
}

export async function updateFoundersPromise(req, res, next) {
  try {
    ok(res, await cmsService.updateFoundersPromise(foundersPromiseSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

const contactInfoSchema = z.object({
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  hours: z.array(z.string()).optional(),
  map_embed: z.string().optional(),
});

export async function getContactInfo(req, res, next) {
  try {
    ok(res, await cmsService.getContactInfo());
  } catch (err) {
    next(err);
  }
}

export async function updateContactInfo(req, res, next) {
  try {
    ok(res, await cmsService.updateContactInfo(contactInfoSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}
