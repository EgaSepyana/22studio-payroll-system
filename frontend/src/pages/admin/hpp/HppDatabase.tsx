import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
import { NoteField, NumField, TextField } from './fields'
import * as hppApi from '@/services/hppApi'
import { getErrorMessage } from '@/services/api'
import { formatCurrency, formatDate } from '@/utils/format'
import { threadCostPerPcs } from '@/utils/hpp'
import type { HppFabric, HppThread } from '@/types'

const includesTerm = (parts: string[], term: string) => parts.join(' ').toLowerCase().includes(term.trim().toLowerCase())

interface PendingDelete {
  kind: 'fabric' | 'thread'
  id: string
  label: string
}

// ---- Bahan ---------------------------------------------------------------------

const EMPTY_FABRIC = { name: '', color: '', supplier: '', price: '', gsm: '', date: '', note: '' }

function FabricsCard({ fabrics, onDelete }: { fabrics: HppFabric[]; onDelete: (d: PendingDelete) => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = React.useState(EMPTY_FABRIC)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState('')
  const set = (patch: Partial<typeof EMPTY_FABRIC>) => setForm((f) => ({ ...f, ...patch }))

  function reset() {
    setForm(EMPTY_FABRIC)
    setEditingId(null)
  }

  const mutation = useMutation({
    mutationFn: () => {
      const input = {
        name: form.name.trim(),
        color: form.color.trim(),
        supplier: form.supplier.trim(),
        price: Number(form.price),
        gsm: Number(form.gsm) || 0,
        date: form.date,
        note: form.note.trim(),
      }
      return editingId ? hppApi.updateFabric(editingId, input) : hppApi.createFabric(input)
    },
    onSuccess: () => {
      toast.success(editingId ? 'Bahan diperbarui' : 'Bahan disimpan')
      reset()
      queryClient.invalidateQueries({ queryKey: ['hpp-fabrics'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  function submit() {
    const price = Number(form.price)
    if (!form.name.trim() || form.price === '' || !Number.isFinite(price) || price < 0) {
      toast.error('Isi nama bahan dan harga/kg yang valid.')
      return
    }
    mutation.mutate()
  }

  function edit(f: HppFabric) {
    setEditingId(f.id)
    setForm({
      name: f.name,
      color: f.color,
      supplier: f.supplier,
      price: String(f.price),
      gsm: f.gsm ? String(f.gsm) : '',
      date: f.date,
      note: f.note,
    })
  }

  const visible = fabrics.filter((f) => includesTerm([f.name, f.color, f.supplier, f.note], search))

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Database Harga Bahan</CardTitle>
        <p className="text-muted-foreground text-sm">
          Simpan jenis kain, supplier, warna, harga per kg, dan tanggal pembaruan. Pilih bahan di kalkulator agar harga
          kain otomatis terisi.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label="Nama bahan *" value={form.name} onChange={(v) => set({ name: v })} placeholder="Cotton Combed 24s" />
          <TextField label="Warna kain" value={form.color} onChange={(v) => set({ color: v })} placeholder="Hitam / Putih / Navy" />
          <TextField label="Supplier" value={form.supplier} onChange={(v) => set({ supplier: v })} placeholder="Nama pemasok" />
          <NumField label="Harga kain (Rp/kg) *" value={form.price} onChange={(v) => set({ price: v })} />
          <NumField label="Gramasi (gsm)" value={form.gsm} onChange={(v) => set({ gsm: v })} />
          <TextField label="Tanggal harga" type="date" value={form.date} onChange={(v) => set({ date: v })} />
          <NoteField
            label="Catatan bahan"
            className="sm:col-span-2"
            value={form.note}
            onChange={(v) => set({ note: v })}
            placeholder="Lebar kain, tipe tubular/open width, minimum order..."
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {editingId ? 'Simpan Perubahan' : 'Simpan Bahan'}
          </Button>
          {editingId && (
            <Button variant="outline" onClick={reset}>
              Batal Edit
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Input
            className="max-w-md"
            placeholder="Cari nama bahan, warna, supplier..."
            aria-label="Cari bahan"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="text-muted-foreground text-xs whitespace-nowrap">{visible.length} bahan</span>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bahan</TableHead>
                <TableHead>Warna</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Harga/kg</TableHead>
                <TableHead>Gramasi</TableHead>
                <TableHead>Update</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground py-6 text-center text-sm">
                    {fabrics.length === 0 ? 'Belum ada bahan. Tambahkan di atas.' : 'Tidak ada bahan sesuai pencarian.'}
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell>{f.color || '-'}</TableCell>
                    <TableCell>{f.supplier || '-'}</TableCell>
                    <TableCell className="text-right">{formatCurrency(f.price)}</TableCell>
                    <TableCell>{f.gsm ? `${f.gsm} gsm` : '-'}</TableCell>
                    <TableCell>{formatDate(f.date)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button size="icon-sm" variant="ghost" aria-label={`Edit ${f.name}`} onClick={() => edit(f)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Hapus ${f.name}`}
                          onClick={() => onDelete({ kind: 'fabric', id: f.id, label: f.name })}
                        >
                          <Trash2 className="text-destructive size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

// ---- Kode warna benang -----------------------------------------------------------

const EMPTY_THREAD = { brand: '', code: '', name: '', hex: '#222222', price: '', yield: '', note: '' }

function ThreadsCard({ threads, onDelete }: { threads: HppThread[]; onDelete: (d: PendingDelete) => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = React.useState(EMPTY_THREAD)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState('')
  const set = (patch: Partial<typeof EMPTY_THREAD>) => setForm((f) => ({ ...f, ...patch }))

  function reset() {
    setForm(EMPTY_THREAD)
    setEditingId(null)
  }

  const mutation = useMutation({
    mutationFn: () => {
      const input = {
        brand: form.brand.trim(),
        code: form.code.trim(),
        name: form.name.trim(),
        hex: form.hex,
        price: Number(form.price),
        yield: Number(form.yield),
        note: form.note.trim(),
      }
      return editingId ? hppApi.updateThread(editingId, input) : hppApi.createThread(input)
    },
    onSuccess: () => {
      toast.success(editingId ? 'Kode benang diperbarui' : 'Kode benang disimpan')
      reset()
      queryClient.invalidateQueries({ queryKey: ['hpp-threads'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  function submit() {
    const price = Number(form.price)
    const yieldPerCone = Number(form.yield)
    if (
      !form.brand.trim() ||
      !form.code.trim() ||
      form.price === '' ||
      form.yield === '' ||
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isFinite(yieldPerCone) ||
      yieldPerCone <= 0
    ) {
      toast.error('Isi merek, kode, harga/cone dan estimasi pcs/cone yang valid.')
      return
    }
    mutation.mutate()
  }

  function edit(t: HppThread) {
    setEditingId(t.id)
    setForm({
      brand: t.brand,
      code: t.code,
      name: t.name,
      hex: t.hex,
      price: String(t.price),
      yield: String(t.yield),
      note: t.note,
    })
  }

  const visible = threads.filter((t) => includesTerm([t.brand, t.code, t.name, t.note], search))

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Database Kode Warna Benang</CardTitle>
        <p className="text-muted-foreground text-sm">
          Kode warna benang berbeda-beda menurut merek dan katalog supplier. Simpan kode asli dari gulungan/kartu warna
          agar pencocokan akurat. Warna HEX hanya pratinjau layar.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label="Merek / supplier benang *" value={form.brand} onChange={(v) => set({ brand: v })} placeholder="Nama merek benang" />
          <TextField label="Kode warna *" value={form.code} onChange={(v) => set({ code: v })} placeholder="Kode dari katalog supplier" />
          <TextField label="Nama warna" value={form.name} onChange={(v) => set({ name: v })} placeholder="Hitam Pekat" />
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="hpp-thread-hex" className="text-xs">
              Warna pratinjau
            </Label>
            <Input
              id="hpp-thread-hex"
              type="color"
              className="h-9 p-1"
              value={form.hex}
              onChange={(e) => set({ hex: e.target.value })}
            />
          </div>
          <NumField label="Harga per cone (Rp) *" value={form.price} onChange={(v) => set({ price: v })} />
          <NumField label="Estimasi pemakaian (pcs / cone) *" value={form.yield} onChange={(v) => set({ yield: v })} />
          <NoteField
            label="Catatan"
            className="sm:col-span-2"
            value={form.note}
            onChange={(v) => set({ note: v })}
            placeholder="Nomor lot / jenis benang / bahan / lokasi rak"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {editingId ? 'Simpan Perubahan' : 'Simpan Kode Benang'}
          </Button>
          {editingId && (
            <Button variant="outline" onClick={reset}>
              Batal Edit
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Input
            className="max-w-md"
            placeholder="Cari merek, kode, nama warna..."
            aria-label="Cari kode benang"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="text-muted-foreground text-xs whitespace-nowrap">{visible.length} kode</span>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Warna</TableHead>
                <TableHead>Kode</TableHead>
                <TableHead>Merek</TableHead>
                <TableHead>Nama warna</TableHead>
                <TableHead className="text-right">Harga/cone</TableHead>
                <TableHead className="text-right">Estimasi biaya/pcs</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground py-6 text-center text-sm">
                    {threads.length === 0 ? 'Belum ada kode benang. Tambahkan di atas.' : 'Tidak ada kode warna sesuai pencarian.'}
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <span
                        className="border-border inline-block size-6 rounded-md border align-middle"
                        style={{ background: t.hex }}
                        title={t.hex}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{t.code}</TableCell>
                    <TableCell>{t.brand}</TableCell>
                    <TableCell>{t.name || '-'}</TableCell>
                    <TableCell className="text-right">{formatCurrency(t.price)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(threadCostPerPcs(t))}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button size="icon-sm" variant="ghost" aria-label={`Edit ${t.code}`} onClick={() => edit(t)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Hapus ${t.code}`}
                          onClick={() => onDelete({ kind: 'thread', id: t.id, label: t.code })}
                        >
                          <Trash2 className="text-destructive size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

// ---- Tab ---------------------------------------------------------------------------

export function HppDatabase({ fabrics, threads }: { fabrics: HppFabric[]; threads: HppThread[] }) {
  const queryClient = useQueryClient()
  const [pending, setPending] = React.useState<PendingDelete | null>(null)

  const deleteMutation = useMutation({
    mutationFn: (d: PendingDelete) => (d.kind === 'fabric' ? hppApi.removeFabric(d.id) : hppApi.removeThread(d.id)),
    onSuccess: (_data, d) => {
      toast.success(d.kind === 'fabric' ? 'Bahan dihapus' : 'Kode benang dihapus')
      queryClient.invalidateQueries({ queryKey: [d.kind === 'fabric' ? 'hpp-fabrics' : 'hpp-threads'] })
      setPending(null)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <div className="flex flex-col gap-4">
      <FabricsCard fabrics={fabrics} onDelete={setPending} />
      <ThreadsCard threads={threads} onDelete={setPending} />

      <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus dari database?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.label} akan dihapus. Perhitungan yang sudah tersimpan tidak berubah.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => pending && deleteMutation.mutate(pending)}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
