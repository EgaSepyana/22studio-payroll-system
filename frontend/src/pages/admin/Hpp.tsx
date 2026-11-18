import * as React from 'react'
import { flushSync } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Boxes,
  Calculator,
  Copy,
  Layers,
  Loader2,
  Printer,
  RotateCcw,
  Save,
  Scissors,
  Shirt,
  Tag,
  Wallet,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { HppHistory } from './hpp/HppHistory'
import { NoteField, NumField, SelectField, TextField, type Option } from './hpp/fields'
import * as hppApi from '@/services/hppApi'
import { getErrorMessage } from '@/services/api'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDateTime } from '@/utils/format'
import {
  PRODUCT_DEFS,
  PRODUCT_TYPES,
  accessoryTotal,
  calcAll,
  defaultState,
  gabungAdditional,
  restoreSavedData,
  summaryText,
  threadCostPerPcs,
  toSavedData,
  type GabungBase,
  type GabungForm,
  type HppResult,
  type HppState,
  type HppTab,
  type KaosForm,
  type ProductType,
  type ProdukForm,
  type SablonForm,
} from '@/utils/hpp'
import type { HppCalculation, HppFabric, HppThread } from '@/types'

const TABS: { value: HppTab; label: string; icon: typeof Shirt }[] = [
  { value: 'kaos', label: 'Kaos Polos', icon: Shirt },
  { value: 'produk', label: 'Produk Konveksi', icon: Scissors },
  { value: 'sablon', label: 'Sablon Manual', icon: Printer },
  { value: 'gabung', label: 'Kaos + Sablon', icon: Layers },
]

const toOptions = (values: string[]): Option[] => values.map((v) => ({ value: v, label: v }))
const MODEL_OPTIONS = toOptions(['Reguler', 'Oversize', 'Polo', 'Long Sleeve'])
const INK_OPTIONS = toOptions(['Plastisol', 'Rubber', 'Discharge', 'High Density', 'Custom'])
const AREA_OPTIONS = toOptions(['A4', 'A3', 'A2', 'Custom'])
const PRODUCT_OPTIONS: Option[] = PRODUCT_TYPES.map((t) => ({ value: t, label: PRODUCT_DEFS[t].title }))
const BASE_OPTIONS: Option[] = [{ value: 'kaos', label: 'Kaos Polos' }, ...PRODUCT_OPTIONS]

function FormCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</CardContent>
    </Card>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-xs leading-relaxed sm:col-span-2">{children}</p>
}

function Swatch({ hex }: { hex?: string }) {
  return (
    <span
      className="border-border inline-block size-8 shrink-0 rounded-md border"
      style={{ background: hex || '#eeeeee' }}
      title="Pratinjau warna"
    />
  )
}

function ThreadInfo({ thread }: { thread: HppThread | undefined }) {
  return (
    <>
      {thread
        ? `${thread.brand} • ${thread.code} • estimasi ${formatCurrency(threadCostPerPcs(thread))}/pcs. Cek kartu warna fisik.`
        : 'Pilih kode untuk mengisi otomatis estimasi biaya benang / pcs.'}
    </>
  )
}

function ResultRow({ label, value, tone }: { label: string; value: string; tone?: 'primary' | 'sale' | 'profit' }) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-3 border-b py-2.5 text-sm last:border-b-0',
        tone && 'mt-2 rounded-lg border-0 px-3 py-3 font-semibold',
        tone === 'primary' && 'bg-primary/10',
        tone === 'sale' && 'bg-warning/10',
        tone === 'profit' && 'bg-success/10'
      )}
    >
      <span className={cn(!tone && 'text-muted-foreground')}>{label}</span>
      <b className={cn('text-right tabular-nums', tone === 'primary' && 'text-primary text-base')}>{value}</b>
    </div>
  )
}

function ResultRows({ r }: { r: HppResult }) {
  return (
    <>
      <ResultRow label="Biaya bahan / pcs" value={formatCurrency(r.mat)} />
      <ResultRow label="Biaya proses / pcs" value={formatCurrency(r.process)} />
      <ResultRow label="Setup & overhead / pcs" value={formatCurrency(r.fixed)} />
      <ResultRow label="HPP / pcs" value={formatCurrency(r.hpp)} tone="primary" />
      <ResultRow label="Total HPP produksi" value={formatCurrency(r.total)} />
      <ResultRow label="Saran harga jual / pcs" value={formatCurrency(r.sale)} tone="sale" />
      <ResultRow label="Laba kotor / pcs" value={formatCurrency(r.sale - r.hpp)} tone="profit" />
    </>
  )
}

export default function HppPage() {
  const queryClient = useQueryClient()
  const topRef = React.useRef<HTMLDivElement>(null)
  const [state, setState] = React.useState<HppState>(defaultState)
  const [tab, setTab] = React.useState<HppTab>('kaos')
  const [resetOpen, setResetOpen] = React.useState(false)
  const [printedAt, setPrintedAt] = React.useState('')

  const { data: fabrics = [] } = useQuery({ queryKey: ['hpp-fabrics'], queryFn: hppApi.listFabrics })
  const { data: threads = [] } = useQuery({ queryKey: ['hpp-threads'], queryFn: hppApi.listThreads })

  const results = React.useMemo(() => calcAll(state), [state])
  const active = results[tab]

  const produk = state.produk[state.produkType]
  const productDef = PRODUCT_DEFS[state.produkType]

  const fabricOptions: Option[] = fabrics.map((f) => ({
    value: f.id,
    label: `${f.name} • ${f.color || '-'} • ${formatCurrency(f.price)}/kg`,
  }))
  const threadOptions: Option[] = threads.map((t) => ({ value: t.id, label: `${t.brand} / ${t.code} • ${t.name || '-'}` }))
  const findFabric = (id: string): HppFabric | undefined => fabrics.find((f) => f.id === id)
  const findThread = (id: string): HppThread | undefined => threads.find((t) => t.id === id)

  const patchKaos = (patch: Partial<KaosForm>) => setState((s) => ({ ...s, kaos: { ...s.kaos, ...patch } }))
  const patchProduk = (patch: Partial<ProdukForm>) =>
    setState((s) => ({ ...s, produk: { ...s.produk, [s.produkType]: { ...s.produk[s.produkType], ...patch } } }))
  const patchAccessory = (id: string, value: string) =>
    setState((s) => {
      const current = s.produk[s.produkType]
      return {
        ...s,
        produk: { ...s.produk, [s.produkType]: { ...current, accessories: { ...current.accessories, [id]: value } } },
      }
    })
  const patchSablon = (patch: Partial<SablonForm>) => setState((s) => ({ ...s, sablon: { ...s.sablon, ...patch } }))
  const patchGabung = (patch: Partial<GabungForm>) => setState((s) => ({ ...s, gabung: { ...s.gabung, ...patch } }))

  function chooseKaosFabric(id: string) {
    const fabric = findFabric(id)
    if (!fabric) return patchKaos({ fabricId: id })
    const line = `Bahan: ${fabric.name}, warna ${fabric.color}, supplier ${fabric.supplier}`
    setState((s) => ({
      ...s,
      kaos: {
        ...s.kaos,
        fabricId: id,
        fprice: String(fabric.price),
        note: s.kaos.note.includes(line) ? s.kaos.note : [s.kaos.note, line].filter(Boolean).join(' | '),
      },
    }))
  }

  function chooseKaosThread(id: string) {
    const thread = findThread(id)
    patchKaos(thread ? { threadId: id, thread: String(threadCostPerPcs(thread)) } : { threadId: id })
  }

  function chooseProdukFabric(id: string) {
    const fabric = findFabric(id)
    patchProduk(fabric ? { fabricId: id, price: String(fabric.price) } : { fabricId: id })
  }

  function chooseProdukThread(id: string) {
    const thread = findThread(id)
    patchProduk(thread ? { threadId: id, thread: String(threadCostPerPcs(thread)) } : { threadId: id })
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      return hppApi.saveCalculation({
        tab,
        name: active.name.trim() || 'Tanpa nama',
        qty: active.q,
        hpp: active.hpp,
        total: active.total,
        sale: active.sale,
        data: toSavedData(tab, state),
      })
    },
    onSuccess: () => {
      toast.success('Perhitungan disimpan')
      queryClient.invalidateQueries({ queryKey: ['hpp-calculations'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  function loadCalculation(calculation: HppCalculation) {
    const restored = restoreSavedData(calculation.data)
    setState(restored.state)
    setTab(restored.tab)
    toast.success('Perhitungan dimuat')
    topRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summaryText(active))
      toast.success('Ringkasan disalin')
    } catch {
      toast.error('Browser tidak mengizinkan salin otomatis')
    }
  }

  // Only the #hpp-print-area block is visible while body has this class (see index.css).
  function printSummary() {
    flushSync(() => setPrintedAt(new Date().toISOString()))
    const cleanup = () => document.body.classList.remove('hpp-printing')
    document.body.classList.add('hpp-printing')
    window.addEventListener('afterprint', cleanup, { once: true })
    window.print()
  }

  return (
    <div ref={topRef}>
      <PageHeader
        title="Kalkulator HPP Produksi"
        description="Hitung HPP kaos polos, polo shirt, sweatshirt, kemeja, jaket, dan sablon manual."
        breadcrumbs={[{ label: 'Dashboard', to: '/admin' }, { label: 'Kalkulator HPP' }]}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as HppTab)} className="mb-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 p-1 group-data-horizontal/tabs:h-auto">
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="h-8 flex-none px-3">
              <Icon className="size-4" /> {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Jumlah Produksi" value={`${active.q} pcs`} icon={Boxes} />
        <StatCard label="HPP / pcs" value={formatCurrency(active.hpp)} icon={Calculator} accent="success" />
        <StatCard label="Total HPP" value={formatCurrency(active.total)} icon={Wallet} />
        <StatCard label="Saran Harga Jual / pcs" value={formatCurrency(active.sale)} icon={Tag} accent="warning" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {tab === 'kaos' && (
            <div className="flex flex-col gap-4">
              <FormCard title="01. Informasi Produk">
                <TextField className="sm:col-span-2" label="Nama produk" value={state.kaos.name} onChange={(v) => patchKaos({ name: v })} />
                <SelectField label="Model kaos" value={state.kaos.model} onChange={(v) => patchKaos({ model: v })} options={MODEL_OPTIONS} />
                <SelectField
                  label="Pilih bahan dari database"
                  value={state.kaos.fabricId}
                  onChange={chooseKaosFabric}
                  options={fabricOptions}
                  noneLabel="— Pilih bahan —"
                />
                <NumField label="Jumlah produksi (pcs)" value={state.kaos.qty} onChange={(v) => patchKaos({ qty: v })} />
                <TextField label="Komposisi ukuran" value={state.kaos.sizes} onChange={(v) => patchKaos({ sizes: v })} />
                <NoteField
                  className="sm:col-span-2"
                  label="Catatan order"
                  value={state.kaos.note}
                  onChange={(v) => patchKaos({ note: v })}
                  placeholder="Warna kain, detail size, jahitan, dll."
                />
              </FormCard>

              <FormCard title="02. Bahan Baku Kaos">
                <NumField label="Pemakaian kain (kg/pcs)" step="0.001" value={state.kaos.kg} onChange={(v) => patchKaos({ kg: v })} />
                <NumField label="Harga kain (Rp/kg)" value={state.kaos.fprice} onChange={(v) => patchKaos({ fprice: v })} />
                <NumField label="Waste kain (%)" value={state.kaos.waste} onChange={(v) => patchKaos({ waste: v })} />
                <NumField label="Rib / kerah (Rp/pcs)" value={state.kaos.rib} onChange={(v) => patchKaos({ rib: v })} />
                <NumField label="Benang (Rp/pcs)" value={state.kaos.thread} onChange={(v) => patchKaos({ thread: v })} />
                <SelectField
                  label="Kode warna benang dari database"
                  value={state.kaos.threadId}
                  onChange={chooseKaosThread}
                  options={threadOptions}
                  noneLabel="— Pilih kode warna benang —"
                  trailing={<Swatch hex={findThread(state.kaos.threadId)?.hex} />}
                  hint={undefined}
                />
                <Hint>
                  <ThreadInfo thread={findThread(state.kaos.threadId)} />
                </Hint>
                <NumField label="Label (Rp/pcs)" value={state.kaos.label} onChange={(v) => patchKaos({ label: v })} />
                <NumField label="Polybag (Rp/pcs)" value={state.kaos.pack} onChange={(v) => patchKaos({ pack: v })} />
                <NumField label="Aksesoris lain (Rp/pcs)" value={state.kaos.other} onChange={(v) => patchKaos({ other: v })} />
              </FormCard>

              <FormCard title="03. Biaya Produksi Kaos">
                <NumField label="Cutting (Rp/pcs)" value={state.kaos.cut} onChange={(v) => patchKaos({ cut: v })} />
                <NumField label="Jahit termasuk obras / overdeck (Rp/pcs)" value={state.kaos.sew} onChange={(v) => patchKaos({ sew: v })} />
                <NumField label="QC, setrika, lipat (Rp/pcs)" value={state.kaos.finish} onChange={(v) => patchKaos({ finish: v })} />
                <NumField label="Overhead batch (Rp)" value={state.kaos.overhead} onChange={(v) => patchKaos({ overhead: v })} />
                <NumField label="Biaya tambahan batch (Rp)" value={state.kaos.extra} onChange={(v) => patchKaos({ extra: v })} />
                <NumField label="Margin target (%)" value={state.kaos.margin} onChange={(v) => patchKaos({ margin: v })} />
                <Hint>
                  Overhead hanya dibebankan di kalkulator kaos. Untuk paket kaos + sablon, biaya bersama tidak dihitung dua kali.
                </Hint>
              </FormCard>
            </div>
          )}

          {tab === 'produk' && (
            <div className="flex flex-col gap-4">
              <FormCard title="01. Detail Produk Konveksi">
                <SelectField
                  className="sm:col-span-2"
                  label="Jenis produk"
                  value={state.produkType}
                  onChange={(v) => setState((s) => ({ ...s, produkType: v as ProductType }))}
                  options={PRODUCT_OPTIONS}
                />
                <TextField className="sm:col-span-2" label="Nama produk / order" value={produk.name} onChange={(v) => patchProduk({ name: v })} />
                <NumField label="Jumlah produksi (pcs)" value={produk.qty} onChange={(v) => patchProduk({ qty: v })} />
                <TextField label="Komposisi ukuran" value={produk.sizes} onChange={(v) => patchProduk({ sizes: v })} />
                <SelectField
                  className="sm:col-span-2"
                  label="Jenis bahan dari database"
                  value={produk.fabricId}
                  onChange={chooseProdukFabric}
                  options={fabricOptions}
                  noneLabel="— Pilih bahan —"
                />
                <SelectField
                  className="sm:col-span-2"
                  label="Kode warna benang dari database"
                  value={produk.threadId}
                  onChange={chooseProdukThread}
                  options={threadOptions}
                  noneLabel="— Pilih kode warna benang —"
                  trailing={<Swatch hex={findThread(produk.threadId)?.hex} />}
                />
                <Hint>
                  <ThreadInfo thread={findThread(produk.threadId)} />
                </Hint>
                <NoteField
                  className="sm:col-span-2"
                  label="Catatan spesifikasi"
                  value={produk.note}
                  onChange={(v) => patchProduk({ note: v })}
                  placeholder="Jenis kerah, rib, resleting, model saku, kombinasi warna, dll."
                />
              </FormCard>

              <FormCard title="02. Kain & Bahan Pokok">
                <NumField label="Kebutuhan kain utama (kg/pcs)" step="0.001" value={produk.kg} onChange={(v) => patchProduk({ kg: v })} />
                <NumField label="Harga kain utama (Rp/kg)" value={produk.price} onChange={(v) => patchProduk({ price: v })} />
                <NumField label="Waste kain (%)" value={produk.waste} onChange={(v) => patchProduk({ waste: v })} />
                <NumField label="Biaya benang (Rp/pcs)" value={produk.thread} onChange={(v) => patchProduk({ thread: v })} />
                <NumField label="Label + hangtag (Rp/pcs)" value={produk.label} onChange={(v) => patchProduk({ label: v })} />
                <NumField label="Packing (Rp/pcs)" value={produk.pack} onChange={(v) => patchProduk({ pack: v })} />
              </FormCard>

              <FormCard
                title={`03. Aksesoris Khusus — ${productDef.title}`}
                description="Setiap jenis produk memiliki rincian biaya sendiri. Masukkan biaya per pcs."
              >
                {productDef.accessories.map((a) => (
                  <NumField key={a.id} label={a.label} value={produk.accessories[a.id] ?? ''} onChange={(v) => patchAccessory(a.id, v)} />
                ))}
                <div className="bg-success/10 flex items-center justify-between rounded-lg px-3 py-3 text-sm font-semibold sm:col-span-2">
                  <span>Total aksesoris / pcs</span>
                  <b>{formatCurrency(accessoryTotal(produk))}</b>
                </div>
                <Hint>Biaya yang tidak dipakai dapat diisi Rp 0. Jangan masukkan biaya jahit atau finishing di sini.</Hint>
              </FormCard>

              <FormCard title="04. Ongkos Produksi">
                <NumField label="Cutting (Rp/pcs)" value={produk.cut} onChange={(v) => patchProduk({ cut: v })} />
                <NumField label="Jahit lengkap (Rp/pcs)" value={produk.sew} onChange={(v) => patchProduk({ sew: v })} />
                <NumField label="QC, setrika & finishing (Rp/pcs)" value={produk.finish} onChange={(v) => patchProduk({ finish: v })} />
                <NumField label="Tambahan proses / pcs (Rp)" value={produk.processExtra} onChange={(v) => patchProduk({ processExtra: v })} />
              </FormCard>

              <FormCard title="05. Overhead & Margin">
                <NumField label="Overhead total batch (Rp)" value={produk.overhead} onChange={(v) => patchProduk({ overhead: v })} />
                <NumField label="Biaya tambahan batch (Rp)" value={produk.batch} onChange={(v) => patchProduk({ batch: v })} />
                <NumField label="Target margin (%)" value={produk.margin} onChange={(v) => patchProduk({ margin: v })} />
                <Hint>
                  Bahan, benang, dan aksesoris dihitung per pcs. Overhead dibagi qty produksi. Nilai awal hanyalah simulasi, bukan
                  tarif baku 22STUDIO.
                </Hint>
              </FormCard>
            </div>
          )}

          {tab === 'sablon' && (
            <div className="flex flex-col gap-4">
              <FormCard title="01. Detail Sablon">
                <TextField className="sm:col-span-2" label="Nama pekerjaan" value={state.sablon.name} onChange={(v) => patchSablon({ name: v })} />
                <NumField label="Jumlah pcs" value={state.sablon.qty} onChange={(v) => patchSablon({ qty: v })} />
                <SelectField label="Jenis tinta / sablon" value={state.sablon.type} onChange={(v) => patchSablon({ type: v })} options={INK_OPTIONS} />
                <SelectField label="Area sablon" value={state.sablon.area} onChange={(v) => patchSablon({ area: v })} options={AREA_OPTIONS} />
                <NumField label="Jumlah posisi cetak" value={state.sablon.positions} onChange={(v) => patchSablon({ positions: v })} />
                <NumField label="Jumlah warna / screen total" value={state.sablon.screens} onChange={(v) => patchSablon({ screens: v })} />
                <TextField label="Catatan posisi" value={state.sablon.placement} onChange={(v) => patchSablon({ placement: v })} />
                <Hint>Isi total screen sesuai warna × posisi. Contoh: depan 2 warna + belakang 1 warna = 3 screen.</Hint>
              </FormCard>

              <FormCard title="02. Persiapan Sablon">
                <NumField label="Film (Rp/screen)" value={state.sablon.film} onChange={(v) => patchSablon({ film: v })} />
                <NumField label="Afdruk (Rp/screen)" value={state.sablon.afdruk} onChange={(v) => patchSablon({ afdruk: v })} />
                <NumField label="Setup / registrasi (Rp/batch)" value={state.sablon.setup} onChange={(v) => patchSablon({ setup: v })} />
                <NumField label="Biaya tambahan batch (Rp)" value={state.sablon.extra} onChange={(v) => patchSablon({ extra: v })} />
              </FormCard>

              <FormCard title="03. Biaya Proses Sablon">
                <NumField label="Tinta sablon (Rp/pcs)" value={state.sablon.ink} onChange={(v) => patchSablon({ ink: v })} />
                <NumField label="Upah sablon (Rp/pcs)" value={state.sablon.labor} onChange={(v) => patchSablon({ labor: v })} />
                <NumField label="Heat press / curing (Rp/pcs)" value={state.sablon.curing} onChange={(v) => patchSablon({ curing: v })} />
                <NumField label="Bahan pendukung (Rp/pcs)" value={state.sablon.support} onChange={(v) => patchSablon({ support: v })} />
                <NumField label="Reject proses (%)" value={state.sablon.reject} onChange={(v) => patchSablon({ reject: v })} />
                <NumField label="Margin target (%)" value={state.sablon.margin} onChange={(v) => patchSablon({ margin: v })} />
                <Hint>
                  Reject digunakan sebagai estimasi cadangan biaya proses. Biaya kaos rusak belum otomatis ditambahkan; tambahkan ke
                  biaya batch bila diperlukan.
                </Hint>
              </FormCard>
            </div>
          )}

          {tab === 'gabung' && (
            <div className="flex flex-col gap-4">
              <FormCard
                title="Paket Kaos Polos + Sablon Manual"
                description="Otomatis mengambil HPP/pcs produk terpilih dan sablon manual."
              >
                <SelectField
                  className="sm:col-span-2"
                  label="Produk dasar untuk paket + sablon"
                  value={state.gabung.base}
                  onChange={(v) => patchGabung({ base: v as GabungBase })}
                  options={BASE_OPTIONS}
                />
                <NumField label="Jumlah paket (pcs)" value={state.gabung.qty} onChange={(v) => patchGabung({ qty: v })} />
                <NumField label="Margin paket (%)" value={state.gabung.margin} onChange={(v) => patchGabung({ margin: v })} />
                <NumField label="Biaya tambahan paket (Rp/pcs)" value={state.gabung.extra} onChange={(v) => patchGabung({ extra: v })} />
                <NumField label="Biaya tambahan batch paket (Rp)" value={state.gabung.batch} onChange={(v) => patchGabung({ batch: v })} />
                <TextField className="sm:col-span-2" label="Nama paket" value={state.gabung.name} onChange={(v) => patchGabung({ name: v })} />
                <Hint>
                  Untuk paket akurat, samakan qty produk dasar dan Sablon Manual dengan qty Paket. Penghitungan menggunakan HPP per pcs
                  masing-masing; jika qty berbeda, biaya setup dan overhead per pcs dapat berbeda. Biaya tambahan paket hanya untuk
                  biaya yang belum dimasukkan di tab lain.
                </Hint>
              </FormCard>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Rincian Paket</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResultRow label="HPP produk dasar / pcs" value={formatCurrency(results.gabungBase.hpp)} />
                  <ResultRow label="HPP sablon manual / pcs" value={formatCurrency(results.sablon.hpp)} />
                  <ResultRow label="Biaya tambahan paket / pcs" value={formatCurrency(gabungAdditional(state.gabung))} />
                  <ResultRow label="HPP paket / pcs" value={formatCurrency(results.gabung.hpp)} tone="primary" />
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
          <Card className="shadow-sm">
            <CardContent className="flex flex-col gap-1">
              <div className="bg-primary text-primary-foreground mb-2 rounded-lg px-4 py-3 text-sm font-semibold">
                Ringkasan Perhitungan
              </div>
              <ResultRows r={active} />
              <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                Harga jual didasarkan pada <strong>margin laba kotor terhadap harga jual</strong>, bukan markup dari HPP. Belum
                mencakup pajak, diskon, ongkir pelanggan atau komisi marketplace.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Aksi Perhitungan</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Simpan
              </Button>
              <Button variant="outline" onClick={printSummary}>
                <Printer className="size-4" /> Cetak / PDF
              </Button>
              <Button variant="outline" onClick={copySummary}>
                <Copy className="size-4" /> Salin Ringkasan
              </Button>
              <Button variant="outline" onClick={() => setResetOpen(true)}>
                <RotateCcw className="size-4" /> Reset Form
              </Button>
            </CardContent>
          </Card>

          <p className="text-muted-foreground px-1 text-xs leading-relaxed">
            Angka awal hanya simulasi, bukan harga biaya aktual 22STUDIO. Sesuaikan dengan konsumsi kain, tarif kerja, afdruk, tinta,
            jumlah cetak, dan harga bahan yang berlaku.
          </p>
        </aside>
      </div>

      <HppHistory onLoad={loadCalculation} />

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset form?</AlertDialogTitle>
            <AlertDialogDescription>Seluruh input kembali ke contoh awal. Perhitungan yang sudah tersimpan tidak terpengaruh.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setState(defaultState())
                setResetOpen(false)
              }}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Shown only when printing (see index.css). */}
      <div id="hpp-print-area" className="hidden print:block">
        <h1 className="text-xl font-bold">22STUDIO · Kalkulator HPP</h1>
        <p className="mb-4 text-sm">
          {active.name || 'Tanpa nama'} · {active.q} pcs
        </p>
        <ResultRows r={active} />
        <p className="mt-6 text-xs">
          Dokumen estimasi biaya internal 22STUDIO · Dicetak dari Kalkulator HPP · {printedAt ? formatDateTime(printedAt) : ''}
        </p>
      </div>
    </div>
  )
}
