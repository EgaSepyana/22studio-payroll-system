// Kalkulator HPP: pure calculation + default state. No React, no imports, so
// utils/hpp.test.mjs can run it on its own. Every form value is kept as the
// string the user typed (blank = 0), like the original single-file calculator.

export type ProductType = 'polo' | 'sweatshirt' | 'kemeja' | 'jaket'
export type HppTab = 'kaos' | 'produk' | 'sablon' | 'gabung'
export type GabungBase = 'kaos' | ProductType

export interface KaosForm {
  name: string
  model: string
  fabricId: string
  qty: string
  sizes: string
  note: string
  kg: string
  fprice: string
  waste: string
  rib: string
  thread: string
  threadId: string
  label: string
  pack: string
  other: string
  cut: string
  sew: string
  finish: string
  overhead: string
  extra: string
  margin: string
}

export interface ProdukForm {
  name: string
  qty: string
  sizes: string
  fabricId: string
  threadId: string
  note: string
  kg: string
  price: string
  waste: string
  thread: string
  label: string
  pack: string
  accessories: Record<string, string>
  cut: string
  sew: string
  finish: string
  processExtra: string
  overhead: string
  batch: string
  margin: string
}

export interface SablonForm {
  name: string
  qty: string
  type: string
  area: string
  positions: string
  screens: string
  placement: string
  film: string
  afdruk: string
  setup: string
  extra: string
  ink: string
  labor: string
  curing: string
  support: string
  reject: string
  margin: string
}

export interface GabungForm {
  base: GabungBase
  name: string
  qty: string
  margin: string
  extra: string
  batch: string
}

export interface HppState {
  kaos: KaosForm
  produkType: ProductType
  produk: Record<ProductType, ProdukForm>
  sablon: SablonForm
  gabung: GabungForm
}

export interface HppResult {
  name: string
  q: number
  mat: number
  process: number
  fixed: number
  hpp: number
  total: number
  sale: number
}

export interface ProductDef {
  title: string
  name: string
  kg: number
  price: number
  cut: number
  sew: number
  finish: number
  accessories: { id: string; label: string; amount: number }[]
}

export const PRODUCT_TYPES: ProductType[] = ['polo', 'sweatshirt', 'kemeja', 'jaket']

const acc = (rows: [string, string, number][]) => rows.map(([id, label, amount]) => ({ id, label, amount }))

export const PRODUCT_DEFS: Record<ProductType, ProductDef> = {
  polo: {
    title: 'Polo Shirt',
    name: 'Polo Shirt Cotton Pique',
    kg: 0.33,
    price: 95000,
    cut: 2000,
    sew: 12000,
    finish: 1600,
    accessories: acc([
      ['kerah', 'Kerah polo (rajut/rib)', 4500],
      ['manset', 'Manset/rib lengan', 2500],
      ['placket', 'Placket / lapis kancing', 800],
      ['kancing', 'Kancing polo', 600],
      ['belah', 'Belahan samping + tape', 500],
      ['aks', 'Aksesoris lainnya', 0],
    ]),
  },
  sweatshirt: {
    title: 'Sweatshirt',
    name: 'Sweatshirt Fleece',
    kg: 0.53,
    price: 105000,
    cut: 2300,
    sew: 14000,
    finish: 1800,
    accessories: acc([
      ['ribkerah', 'Rib leher', 1600],
      ['ribmanset', 'Rib manset lengan', 2500],
      ['ribbawah', 'Rib pinggang bawah', 3500],
      ['pocket', 'Kantong / aplikasi tambahan', 0],
      ['akses', 'Aksesoris lainnya', 0],
    ]),
  },
  kemeja: {
    title: 'Kemeja',
    name: 'Kemeja Twill Lengan Panjang',
    kg: 0.4,
    price: 85000,
    cut: 2700,
    sew: 18500,
    finish: 2600,
    accessories: acc([
      ['kerah', 'Bahan kerah & cuff', 2200],
      ['keras', 'Interlining / kain keras', 1400],
      ['kancing', 'Kancing depan & manset', 1800],
      ['saku', 'Saku / flap', 1000],
      ['pelapis', 'Lapisan tambahan', 0],
      ['aks', 'Aksesoris lainnya', 0],
    ]),
  },
  jaket: {
    title: 'Jaket',
    name: 'Jaket Taslan dengan Furing',
    kg: 0.7,
    price: 95000,
    cut: 4000,
    sew: 28500,
    finish: 3800,
    accessories: acc([
      ['resleting', 'Resleting utama', 7500],
      ['zipkantong', 'Resleting saku', 3500],
      ['furing', 'Kain furing / lining per pcs', 12500],
      ['rib', 'Rib / manset / karet', 4500],
      ['hoodie', 'Tali / stopper / mata ayam', 1700],
      ['padding', 'Padding / busa / lapis', 0],
      ['aks', 'Aksesoris lainnya', 0],
    ]),
  },
}

const DEFAULT_SIZES = 'S:20, M:30, L:30, XL:20'

export function defaultKaos(): KaosForm {
  return {
    name: 'Kaos Reguler Cotton Combed 24s',
    model: 'Reguler',
    fabricId: '',
    qty: '100',
    sizes: DEFAULT_SIZES,
    note: '',
    kg: '0.25',
    fprice: '90000',
    waste: '5',
    rib: '1500',
    thread: '500',
    threadId: '',
    label: '700',
    pack: '500',
    other: '0',
    cut: '1500',
    sew: '7000',
    finish: '1200',
    overhead: '100000',
    extra: '0',
    margin: '30',
  }
}

export function defaultProduk(type: ProductType): ProdukForm {
  const def = PRODUCT_DEFS[type]
  return {
    name: def.name,
    qty: '100',
    sizes: DEFAULT_SIZES,
    fabricId: '',
    threadId: '',
    note: '',
    kg: String(def.kg),
    price: String(def.price),
    waste: '5',
    thread: '500',
    label: '1000',
    pack: '700',
    accessories: Object.fromEntries(def.accessories.map((a) => [a.id, String(a.amount)])),
    cut: String(def.cut),
    sew: String(def.sew),
    finish: String(def.finish),
    processExtra: '0',
    overhead: '150000',
    batch: '0',
    margin: '30',
  }
}

export function defaultSablon(): SablonForm {
  return {
    name: 'Sablon Manual Plastisol',
    qty: '100',
    type: 'Plastisol',
    area: 'A3',
    positions: '1',
    screens: '1',
    placement: 'Depan 1 warna',
    film: '25000',
    afdruk: '40000',
    setup: '50000',
    extra: '0',
    ink: '2500',
    labor: '1500',
    curing: '500',
    support: '300',
    reject: '3',
    margin: '30',
  }
}

export function defaultGabung(): GabungForm {
  return { base: 'kaos', name: 'Kaos Custom Sablon Manual', qty: '100', margin: '30', extra: '0', batch: '0' }
}

export function defaultState(): HppState {
  return {
    kaos: defaultKaos(),
    produkType: 'polo',
    produk: {
      polo: defaultProduk('polo'),
      sweatshirt: defaultProduk('sweatshirt'),
      kemeja: defaultProduk('kemeja'),
      jaket: defaultProduk('jaket'),
    },
    sablon: defaultSablon(),
    gabung: defaultGabung(),
  }
}

// ---- calculation --------------------------------------------------------------

const numeric = (value: string | undefined) => Math.max(0, Number(value) || 0)
const quantity = (value: string | undefined) => Math.max(1, Math.floor(numeric(value) || 1))
// Margin is a share of the selling price (not a markup on HPP), capped below 100%.
const marginShare = (value: string | undefined) => Math.min(99.9, numeric(value)) / 100

function finish(name: string, q: number, mat: number, process: number, fixed: number, margin: string): HppResult {
  const hpp = mat + process + fixed
  return { name, q, mat, process, fixed, hpp, total: hpp * q, sale: hpp / (1 - marginShare(margin)) }
}

export function calcKaos(f: KaosForm): HppResult {
  const q = quantity(f.qty)
  const mat =
    numeric(f.kg) * numeric(f.fprice) * (1 + numeric(f.waste) / 100) +
    numeric(f.rib) +
    numeric(f.thread) +
    numeric(f.label) +
    numeric(f.pack) +
    numeric(f.other)
  const process = numeric(f.cut) + numeric(f.sew) + numeric(f.finish)
  const fixed = (numeric(f.overhead) + numeric(f.extra)) / q
  return finish(f.name, q, mat, process, fixed, f.margin)
}

export function accessoryTotal(f: ProdukForm): number {
  return Object.values(f.accessories).reduce((sum, v) => sum + numeric(v), 0)
}

export function calcProduk(f: ProdukForm): HppResult {
  const q = quantity(f.qty)
  const mat =
    numeric(f.kg) * numeric(f.price) * (1 + numeric(f.waste) / 100) +
    numeric(f.thread) +
    numeric(f.label) +
    numeric(f.pack) +
    accessoryTotal(f)
  const process = numeric(f.cut) + numeric(f.sew) + numeric(f.finish) + numeric(f.processExtra)
  const fixed = (numeric(f.overhead) + numeric(f.batch)) / q
  return finish(f.name, q, mat, process, fixed, f.margin)
}

export function calcSablon(f: SablonForm): HppResult {
  const q = quantity(f.qty)
  const screens = quantity(f.screens)
  const mat = numeric(f.ink) + numeric(f.support)
  const process = numeric(f.labor) + numeric(f.curing)
  const fixed = (screens * (numeric(f.film) + numeric(f.afdruk)) + numeric(f.setup) + numeric(f.extra)) / q
  // Reject % is a cost reserve spread over every figure.
  const reserve = 1 / (1 - Math.min(99.9, numeric(f.reject)) / 100)
  return finish(f.name, q, mat * reserve, process * reserve, fixed * reserve, f.margin)
}

export function gabungAdditional(f: GabungForm): number {
  return numeric(f.extra) + numeric(f.batch) / quantity(f.qty)
}

export function calcGabung(f: GabungForm, base: HppResult, sablon: HppResult): HppResult {
  const q = quantity(f.qty)
  const additional = gabungAdditional(f)
  return finish(
    f.name,
    q,
    base.mat + sablon.mat,
    base.process + sablon.process,
    base.fixed + sablon.fixed + additional,
    f.margin
  )
}

export interface HppResults {
  kaos: HppResult
  produk: HppResult
  sablon: HppResult
  gabung: HppResult
  gabungBase: HppResult
}

export function calcAll(state: HppState): HppResults {
  const kaos = calcKaos(state.kaos)
  const produk = calcProduk(state.produk[state.produkType])
  const sablon = calcSablon(state.sablon)
  const gabungBase =
    state.gabung.base === 'kaos' ? kaos : calcProduk(state.produk[state.gabung.base])
  return { kaos, produk, sablon, gabungBase, gabung: calcGabung(state.gabung, gabungBase, sablon) }
}

// ---- helpers used by the page --------------------------------------------------

export function threadCostPerPcs(thread: { price: number; yield: number }): number {
  return Math.round((Number(thread.price) || 0) / Math.max(1, Number(thread.yield) || 1))
}

export function summaryText(r: HppResult): string {
  const money = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`
  return [
    `22STUDIO - ${r.name}`,
    `Jumlah: ${r.q} pcs`,
    `HPP per pcs: ${money(r.hpp)}`,
    `Total HPP: ${money(r.total)}`,
    `Harga jual saran: ${money(r.sale)} / pcs`,
    `Laba kotor: ${money(r.sale - r.hpp)} / pcs`,
  ].join('\n')
}

// ---- saved calculations ---------------------------------------------------------

export const HPP_DATA_VERSION = 1

export interface SavedHppData {
  version: typeof HPP_DATA_VERSION
  tab: HppTab
  state: HppState
}

export function toSavedData(tab: HppTab, state: HppState): SavedHppData {
  return { version: HPP_DATA_VERSION, tab, state }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

// Copies only string values for keys the defaults already have, so a saved
// calculation from an older/damaged row can't inject unknown or mistyped fields.
function overlay<T extends object>(defaults: T, saved: unknown): T {
  const out = { ...defaults } as Record<string, unknown>
  if (!isRecord(saved)) return out as T
  for (const key of Object.keys(defaults)) {
    if (typeof (defaults as Record<string, unknown>)[key] === 'string' && typeof saved[key] === 'string') {
      out[key] = saved[key]
    }
  }
  return out as T
}

export function restoreState(saved: unknown): HppState {
  const base = defaultState()
  if (!isRecord(saved)) return base
  const produk = isRecord(saved.produk) ? saved.produk : {}
  for (const type of PRODUCT_TYPES) {
    const defaults = base.produk[type]
    const entry = produk[type]
    const merged = overlay(defaults, entry)
    const savedAccessories = isRecord(entry) && isRecord(entry.accessories) ? entry.accessories : {}
    merged.accessories = Object.fromEntries(
      Object.entries(defaults.accessories).map(([id, value]) => [
        id,
        typeof savedAccessories[id] === 'string' ? savedAccessories[id] : value,
      ])
    )
    base.produk[type] = merged
  }
  const type = PRODUCT_TYPES.find((t) => t === saved.produkType)
  const gabung = overlay(base.gabung, saved.gabung)
  const gabungBase = gabung.base === 'kaos' || PRODUCT_TYPES.includes(gabung.base as ProductType) ? gabung.base : 'kaos'
  return {
    kaos: overlay(base.kaos, saved.kaos),
    produkType: type ?? base.produkType,
    produk: base.produk,
    sablon: overlay(base.sablon, saved.sablon),
    gabung: { ...gabung, base: gabungBase },
  }
}

export function restoreSavedData(data: unknown): { tab: HppTab; state: HppState } {
  const record = isRecord(data) ? data : {}
  const tab = (['kaos', 'produk', 'sablon', 'gabung'] as const).find((t) => t === record.tab) ?? 'kaos'
  return { tab, state: restoreState(record.state) }
}
