import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import * as ownerSettingsApi from '@/services/ownerSettingsApi'
import { getErrorMessage } from '@/services/api'
import type { OwnerBusinessSettings, OwnerCategoryType, OwnerCogsBucket } from '@/types'

const CATEGORY_TYPE_OPTIONS: { value: OwnerCategoryType; label: string }[] = [
  { value: 'income', label: 'Pemasukan' },
  { value: 'expense', label: 'Pengeluaran' },
  { value: 'asset', label: 'Aset' },
  { value: 'inventory', label: 'Stok Persediaan' },
  { value: 'liability', label: 'Kewajiban' },
]

const COGS_BUCKET_OPTIONS: { value: OwnerCogsBucket; label: string }[] = [
  { value: 'fabric_purchase', label: 'Pembelian Bahan' },
  { value: 'production_cost', label: 'Biaya Produksi' },
  { value: 'generic', label: 'HPP Umum' },
]

const BUSINESS_FIELDS: { key: keyof OwnerBusinessSettings; label: string; multiline?: boolean }[] = [
  { key: 'name', label: 'Nama Usaha' },
  { key: 'address', label: 'Alamat', multiline: true },
  { key: 'phone', label: 'No Telepon' },
  { key: 'monthly_revenue_target', label: 'Target Omset Bulanan (Rp)' },
  { key: 'daily_target', label: 'Target Harian' },
  { key: 'monthly_target', label: 'Target Bulanan' },
  { key: 'owner_name', label: 'Nama Owner (untuk tanda tangan laporan)' },
  { key: 'admin_name', label: 'Nama Admin (untuk tanda tangan laporan)' },
  { key: 'notes', label: 'Catatan', multiline: true },
]

function BusinessProfileSection() {
  const queryClient = useQueryClient()
  const [values, setValues] = React.useState<Partial<OwnerBusinessSettings>>({})
  const [dirty, setDirty] = React.useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['owner-business-settings'],
    queryFn: ownerSettingsApi.getBusinessSettings,
  })

  React.useEffect(() => {
    if (data && !dirty) setValues(data)
  }, [data, dirty])

  const mutation = useMutation({
    mutationFn: () => ownerSettingsApi.updateBusinessSettings(values),
    onSuccess: () => {
      toast.success('Profil usaha berhasil disimpan')
      setDirty(false)
      queryClient.invalidateQueries({ queryKey: ['owner-business-settings'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  function setField(key: keyof OwnerBusinessSettings, value: string) {
    setValues((v) => ({ ...v, [key]: value }))
    setDirty(true)
  }

  return (
    <Card className="shadow-sm">
      <CardContent className="flex flex-col gap-4">
        <div>
          <h3 className="font-heading text-sm font-semibold">Profil Usaha</h3>
          <p className="text-muted-foreground text-xs">
            Dipakai pada Dashboard Keuangan dan tanda tangan laporan Laba Rugi / Neraca.
          </p>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {BUSINESS_FIELDS.map((field) => (
              <div key={field.key} className={field.multiline ? 'sm:col-span-2' : ''}>
                <label className="text-muted-foreground mb-1.5 block text-xs font-medium">{field.label}</label>
                {field.multiline ? (
                  <Textarea
                    value={values[field.key] || ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                    rows={3}
                  />
                ) : (
                  <Input value={values[field.key] || ''} onChange={(e) => setField(field.key, e.target.value)} />
                )}
              </div>
            ))}
          </div>
        )}
        <Button
          size="sm"
          className="w-fit"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || isLoading}
        >
          {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
          Simpan
        </Button>
      </CardContent>
    </Card>
  )
}

function CategoriesSection() {
  const queryClient = useQueryClient()
  const [type, setType] = React.useState<OwnerCategoryType>('income')
  const [newName, setNewName] = React.useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['owner-categories', type],
    queryFn: () => ownerSettingsApi.listCategories(type),
  })

  const createMutation = useMutation({
    mutationFn: () => ownerSettingsApi.createCategory({ type, name: newName }),
    onSuccess: () => {
      toast.success('Kategori ditambahkan')
      setNewName('')
      queryClient.invalidateQueries({ queryKey: ['owner-categories', type] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const toggleMutation = useMutation({
    mutationFn: (vars: { id: string; is_active: boolean }) =>
      ownerSettingsApi.updateCategory(vars.id, { is_active: vars.is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owner-categories', type] }),
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const toggleSalesMutation = useMutation({
    mutationFn: (vars: { id: string; is_sales_category: boolean }) =>
      ownerSettingsApi.updateCategory(vars.id, { is_sales_category: vars.is_sales_category }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owner-categories', type] }),
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const cogsBucketMutation = useMutation({
    mutationFn: (vars: { id: string; cogs_bucket: OwnerCogsBucket }) =>
      ownerSettingsApi.updateCategory(vars.id, { cogs_bucket: vars.cogs_bucket }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owner-categories', type] }),
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ownerSettingsApi.deleteCategory(id),
    onSuccess: () => {
      toast.success('Kategori dihapus')
      queryClient.invalidateQueries({ queryKey: ['owner-categories', type] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Card className="shadow-sm">
      <CardContent className="flex flex-col gap-4">
        <div>
          <h3 className="font-heading text-sm font-semibold">Kategori</h3>
          <p className="text-muted-foreground text-xs">
            Sumber pilihan kategori untuk setiap modul Keuangan.
          </p>
        </div>

        <Tabs value={type} onValueChange={(v) => setType(v as OwnerCategoryType)}>
          <TabsList className="flex-wrap">
            {CATEGORY_TYPE_OPTIONS.map((opt) => (
              <TabsTrigger key={opt.value} value={opt.value}>{opt.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (newName.trim()) createMutation.mutate()
          }}
        >
          <Input
            placeholder="Nama kategori baru..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={createMutation.isPending || !newName.trim()}>
            {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Tambah
          </Button>
        </form>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : data?.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">Belum ada kategori.</p>
        ) : (
          <div className="flex flex-col divide-y">
            {data?.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={cat.is_active ? '' : 'text-muted-foreground line-through'}>{cat.name}</span>
                  {!cat.is_active && <Badge variant="secondary">Nonaktif</Badge>}
                  {cat.is_sales_category && <Badge>Penjualan</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  {type === 'income' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        toggleSalesMutation.mutate({ id: cat.id, is_sales_category: !cat.is_sales_category })
                      }
                    >
                      {cat.is_sales_category ? 'Bukan Penjualan' : 'Tandai Penjualan'}
                    </Button>
                  )}
                  {type === 'liability' && (
                    <Select
                      value={cat.cogs_bucket || 'generic'}
                      onValueChange={(v) => cogsBucketMutation.mutate({ id: cat.id, cogs_bucket: v as OwnerCogsBucket })}
                    >
                      <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COGS_BUCKET_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleMutation.mutate({ id: cat.id, is_active: !cat.is_active })}
                  >
                    {cat.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(cat.id)}>
                    <Trash2 className="text-destructive size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function LocationsSection() {
  const queryClient = useQueryClient()
  const [newName, setNewName] = React.useState('')

  const { data, isLoading } = useQuery({ queryKey: ['owner-locations'], queryFn: ownerSettingsApi.listLocations })

  const createMutation = useMutation({
    mutationFn: () => ownerSettingsApi.createLocation({ name: newName }),
    onSuccess: () => {
      toast.success('Lokasi ditambahkan')
      setNewName('')
      queryClient.invalidateQueries({ queryKey: ['owner-locations'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const toggleMutation = useMutation({
    mutationFn: (vars: { id: string; is_active: boolean }) =>
      ownerSettingsApi.updateLocation(vars.id, { is_active: vars.is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owner-locations'] }),
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ownerSettingsApi.deleteLocation(id),
    onSuccess: () => {
      toast.success('Lokasi dihapus')
      queryClient.invalidateQueries({ queryKey: ['owner-locations'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Card className="shadow-sm">
      <CardContent className="flex flex-col gap-4">
        <div>
          <h3 className="font-heading text-sm font-semibold">Lokasi</h3>
          <p className="text-muted-foreground text-xs">Dipakai oleh modul Aset dan Stok Persediaan.</p>
        </div>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (newName.trim()) createMutation.mutate()
          }}
        >
          <Input
            placeholder="Nama lokasi baru..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={createMutation.isPending || !newName.trim()}>
            {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Tambah
          </Button>
        </form>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : data?.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">Belum ada lokasi.</p>
        ) : (
          <div className="flex flex-col divide-y">
            {data?.map((loc) => (
              <div key={loc.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={loc.is_active ? '' : 'text-muted-foreground line-through'}>{loc.name}</span>
                  {!loc.is_active && <Badge variant="secondary">Nonaktif</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleMutation.mutate({ id: loc.id, is_active: !loc.is_active })}
                  >
                    {loc.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(loc.id)}>
                    <Trash2 className="text-destructive size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function OwnerSettingsPage() {
  return (
    <div>
      <PageHeader
        title="Pengaturan Keuangan"
        description="Profil usaha, kategori, dan lokasi untuk modul Keuangan"
        breadcrumbs={[{ label: 'Dashboard', to: '/owner' }, { label: 'Pengaturan Keuangan' }]}
      />

      <div className="flex flex-col gap-4">
        <BusinessProfileSection />
        <CategoriesSection />
        <LocationsSection />
      </div>
    </div>
  )
}
