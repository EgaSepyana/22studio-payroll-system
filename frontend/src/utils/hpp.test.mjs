// Runs with `npm test` (node:test, no extra dependencies). hpp.ts is plain
// TypeScript with no imports, so TypeScript's own transpiler (already a dev
// dependency) is enough to load it here.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync(new URL('./hpp.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: 'ESNext', target: 'ES2022' } })
const hpp = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

const close = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(actual), Math.abs(expected)), `${actual} !== ${expected}`)

function assertResult(r, expected) {
  assert.equal(r.q, expected.q)
  for (const key of ['mat', 'process', 'fixed', 'hpp', 'total', 'sale']) close(r[key], expected[key])
}

// Golden values: the original 22STUDIO-Kalkulator-HPP-v3.html formulas run on
// its own default inputs.
test('default Kaos Polos matches the original calculator', () => {
  assertResult(hpp.calcKaos(hpp.defaultKaos()), {
    q: 100, mat: 26825, process: 9700, fixed: 1000, hpp: 37525, total: 3752500, sale: 53607.14285714286,
  })
})

test('default Polo Shirt matches the original calculator', () => {
  assertResult(hpp.calcProduk(hpp.defaultProduk('polo')), {
    q: 100, mat: 44017.5, process: 15600, fixed: 1500, hpp: 61117.5, total: 6111750, sale: 87310.71428571429,
  })
})

test('default Sablon Manual matches the original calculator', () => {
  assertResult(hpp.calcSablon(hpp.defaultSablon()), {
    q: 100, mat: 2886.5979381443303, process: 2061.855670103093, fixed: 1185.5670103092784, hpp: 6134.020618556701, total: 613402.0618556702, sale: 8762.886597938144,
  })
})

test('default packages (Kaos + Sablon, Polo + Sablon) match the original calculator', () => {
  const results = hpp.calcAll(hpp.defaultState())
  assertResult(results.gabung, {
    q: 100, mat: 29711.597938144332, process: 11761.855670103094, fixed: 2185.5670103092784, hpp: 43659.0206185567, total: 4365902.06185567, sale: 62370.02945508101,
  })
  const state = hpp.defaultState()
  state.gabung.base = 'polo'
  assertResult(hpp.calcAll(state).gabung, {
    q: 100, mat: 46904.09793814433, process: 17661.855670103094, fixed: 2685.5670103092784, hpp: 67251.52061855671, total: 6725152.061855671, sale: 96073.60088365244,
  })
})

test('the package takes the base product from its own state, not the active product tab', () => {
  const state = hpp.defaultState()
  state.gabung.base = 'polo'
  state.produkType = 'jaket'
  const results = hpp.calcAll(state)
  close(results.gabungBase.hpp, hpp.calcProduk(state.produk.polo).hpp)
  assert.notEqual(results.produk.hpp, results.gabungBase.hpp)
})

test('blank, negative and non-numeric inputs count as 0; quantity is at least 1', () => {
  const f = hpp.defaultKaos()
  Object.assign(f, { qty: '', kg: 'abc', fprice: '-5', rib: '', thread: '', label: '', pack: '', other: '', cut: '', sew: '', finish: '', overhead: '1000', extra: '' })
  const r = hpp.calcKaos(f)
  assert.equal(r.q, 1)
  assert.equal(r.mat, 0)
  assert.equal(r.fixed, 1000)
  assert.equal(hpp.calcKaos({ ...f, qty: '3.9' }).q, 3)
  assert.equal(hpp.calcKaos({ ...f, qty: '-4' }).q, 1)
})

test('margin is a share of the selling price and is capped below 100%', () => {
  const f = { ...hpp.defaultKaos(), margin: '50' }
  const r = hpp.calcKaos(f)
  close(r.sale, r.hpp * 2)
  const capped = hpp.calcKaos({ ...f, margin: '150' })
  close(capped.sale, capped.hpp / (1 - 0.999))
  close(hpp.calcKaos({ ...f, margin: '0' }).sale, hpp.calcKaos({ ...f, margin: '' }).hpp)
})

test('sablon: screens multiply film and afdruk, reject reserve scales every figure', () => {
  const base = { ...hpp.defaultSablon(), reject: '0' }
  const one = hpp.calcSablon({ ...base, screens: '1' })
  const three = hpp.calcSablon({ ...base, screens: '3' })
  close(three.fixed - one.fixed, (2 * (25000 + 40000)) / 100)
  const withReject = hpp.calcSablon({ ...base, reject: '10' })
  close(withReject.hpp, one.hpp / 0.9)
  close(hpp.calcSablon({ ...base, screens: '0' }).fixed, one.fixed)
})

test('produk: every product type defaults to the accessory list of the original', () => {
  const totals = Object.fromEntries(hpp.PRODUCT_TYPES.map((t) => [t, hpp.accessoryTotal(hpp.defaultProduk(t))]))
  assert.deepEqual(totals, { polo: 8900, sweatshirt: 7600, kemeja: 6400, jaket: 29700 })
  assert.deepEqual(Object.keys(hpp.defaultProduk('jaket').accessories), ['resleting', 'zipkantong', 'furing', 'rib', 'hoodie', 'padding', 'aks'])
})

test('paket: additional cost per pcs adds batch cost divided by quantity', () => {
  const g = { ...hpp.defaultGabung(), qty: '50', extra: '100', batch: '5000' }
  close(hpp.gabungAdditional(g), 200)
})

test('threadCostPerPcs rounds price per cone over estimated pcs', () => {
  assert.equal(hpp.threadCostPerPcs({ price: 15000, yield: 100 }), 150)
  assert.equal(hpp.threadCostPerPcs({ price: 1000, yield: 3 }), 333)
  assert.equal(hpp.threadCostPerPcs({ price: 1000, yield: 0 }), 1000)
})

test('summaryText has the lines the original copy button produced', () => {
  const text = hpp.summaryText({ name: 'Kaos A', q: 100, mat: 0, process: 0, fixed: 0, hpp: 37525, total: 3752500, sale: 53607.14 })
  const lines = text.split('\n')
  assert.equal(lines[0], '22STUDIO - Kaos A')
  assert.equal(lines[1], 'Jumlah: 100 pcs')
  assert.match(lines[2], /^HPP per pcs: Rp 37\.525$/)
  assert.match(lines[3], /^Total HPP: Rp 3\.752\.500$/)
  assert.match(lines[4], /^Harga jual saran: Rp 53\.607 \/ pcs$/)
  assert.match(lines[5], /^Laba kotor: Rp 16\.082 \/ pcs$/)
})

// ---- saved calculations ---------------------------------------------------------

test('a saved calculation restores exactly', () => {
  const state = hpp.defaultState()
  state.kaos.qty = '250'
  state.produkType = 'jaket'
  state.produk.jaket.accessories.furing = '9999'
  state.gabung.base = 'kemeja'
  const saved = JSON.parse(JSON.stringify(hpp.toSavedData('gabung', state)))
  assert.equal(saved.version, 1)
  const restored = hpp.restoreSavedData(saved)
  assert.equal(restored.tab, 'gabung')
  assert.deepEqual(restored.state, state)
})

test('restoring ignores unknown keys, mistyped values and missing parts', () => {
  const defaults = hpp.defaultState()
  assert.deepEqual(hpp.restoreSavedData(null), { tab: 'kaos', state: defaults })
  assert.deepEqual(hpp.restoreSavedData('junk'), { tab: 'kaos', state: defaults })
  assert.deepEqual(hpp.restoreSavedData({ tab: 'database', state: {} }), { tab: 'kaos', state: defaults })

  const messy = {
    tab: 'sablon',
    state: {
      kaos: { qty: 5, name: 'Dari simpanan', evil: 'x', __proto__: { polluted: 1 } },
      produkType: 'mobil',
      produk: { polo: { accessories: { kerah: 123, kancing: '700', ghost: '1' }, kg: ['x'] } },
      gabung: { base: 'pesawat', qty: '7' },
    },
  }
  const { tab, state } = hpp.restoreSavedData(messy)
  assert.equal(tab, 'sablon')
  assert.equal(state.kaos.qty, '100')
  assert.equal(state.kaos.name, 'Dari simpanan')
  assert.equal('evil' in state.kaos, false)
  assert.equal(state.produkType, 'polo')
  assert.equal(state.produk.polo.accessories.kerah, '4500')
  assert.equal(state.produk.polo.accessories.kancing, '700')
  assert.equal('ghost' in state.produk.polo.accessories, false)
  assert.equal(state.produk.polo.kg, '0.33')
  assert.equal(state.gabung.base, 'kaos')
  assert.equal(state.gabung.qty, '7')
  assert.equal({}.polluted, undefined)
})

test('defaults are independent copies', () => {
  const a = hpp.defaultState()
  const b = hpp.defaultState()
  a.produk.polo.accessories.kerah = '1'
  assert.equal(b.produk.polo.accessories.kerah, '4500')
})
