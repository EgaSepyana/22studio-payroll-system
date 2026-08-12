import * as React from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, ChevronDown } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { RowActionsMenu, type RowAction } from '@/components/RowActionsMenu'
import { MobileCardList, MobileCard, MobileCardRow } from '@/components/MobileCardList'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import * as customerApi from '@/services/customerApi'
import * as articleApi from '@/services/articleApi'
import * as articleCategoryApi from '@/services/articleCategoryApi'
import { getErrorMessage } from '@/services/api'
import { formatDate } from '@/utils/format'
import type { Customer, CustomerCategory } from '@/types'

const NONE = '__none__'

const CUSTOMER_CATEGORIES: CustomerCategory[] = [
  'BRAND OWNER',
  'KAOS ANAK',
  'KAOS EVENT',
  'KAOS WISATA',
  'SERAGAM KOMUNITAS',
  'SERAGAM PERUSAHAAN',
  'SERAGAM SEKOLAH',
]

const schema = z.object({
  name: z.string().min(1, 'Nama customer wajib diisi'),
  pic: z.string().optional(),
  alamat: z.string().optional(),
  no_hp: z.string().optional(),
  category: z.string().optional(),
  category_ids: z.array(z.string()),
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

function CustomerFormDialog({
  customer,
  open,
  onOpenChange,
}: {
  customer?: Customer
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isEdit = !!customer
  const queryClient = useQueryClient()
  const { data: categories } = useQuery({
    queryKey: ['article-categories'],
    queryFn: articleCategoryApi.listArticleCategories,
  })
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: customer?.name || '',
      pic: customer?.pic || '',
      alamat: customer?.alamat || '',
      no_hp: customer?.no_hp || '',
      category: customer?.category || '',
      category_ids: customer?.category_ids || [],
    },
  })

  React.useEffect(() => {
    if (open) {
      form.reset({
        name: customer?.name || '',
        pic: customer?.pic || '',
        alamat: customer?.alamat || '',
        no_hp: customer?.no_hp || '',
        category: customer?.category || '',
        category_ids: customer?.category_ids || [],
      })
    }
  }, [open, customer, form])

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const { category_ids, ...rest } = values
      const payload = {
        ...rest,
        category: rest.category || undefined,
      } as customerApi.CustomerInput
      const saved = isEdit
        ? await customerApi.updateCustomer(customer.id, payload)
        : await customerApi.createCustomer(payload)
      await customerApi.setCustomerCategories(saved.id, category_ids)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Customer diperbarui' : 'Customer ditambahkan')
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['article-categories'] })
      queryClient.invalidateQueries({ queryKey: ['articles'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Customer' : 'Tambah Customer'}</DialogTitle>
          <DialogDescription>Contoh: Sugarship, Erigo, Compass.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Customer</FormLabel>
                  <FormControl>
                    <Input placeholder="Nama customer" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PIC (opsional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Nama contact person" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="no_hp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>No HP (opsional)</FormLabel>
                  <FormControl>
                    <Input placeholder="08xx-xxxx-xxxx" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category (opsional)</FormLabel>
                  <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? '' : v)}>
                    <FormControl>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Pilih category" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>Tidak ada</SelectItem>
                      {CUSTOMER_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category_ids"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kategori Artikel (opsional)</FormLabel>
                  <DropdownMenu>
                    <FormControl>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-normal">
                          {field.value.length === 0
                            ? 'Pilih kategori artikel'
                            : field.value.length === 1
                              ? categories?.find((c) => c.id === field.value[0])?.name || '1 kategori dipilih'
                              : `${field.value.length} kategori dipilih`}
                          <ChevronDown className="size-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                    </FormControl>
                    <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
                      {categories?.map((c) => {
                        const checked = field.value.includes(c.id)
                        return (
                          <DropdownMenuCheckboxItem
                            key={c.id}
                            checked={checked}
                            onCheckedChange={(v) =>
                              field.onChange(v ? [...field.value, c.id] : field.value.filter((id) => id !== c.id))
                            }
                            onSelect={(e) => e.preventDefault()}
                          >
                            {c.name}
                          </DropdownMenuCheckboxItem>
                        )
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="alamat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alamat (opsional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Alamat lengkap" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default function Customers() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Customer | undefined>(undefined)
  const [deletingCustomer, setDeletingCustomer] = React.useState<Customer | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['customers'], queryFn: customerApi.listCustomers })
  const { data: articles } = useQuery({ queryKey: ['articles'], queryFn: () => articleApi.listArticles() })

  const articleNamesByCustomer = React.useMemo(() => {
    const map = new Map<string, string[]>()
    for (const article of articles || []) {
      for (const customerId of article.customer_ids) {
        const existing = map.get(customerId) || []
        existing.push(article.article_name)
        map.set(customerId, existing)
      }
    }
    return map
  }, [articles])

  const deleteMutation = useMutation({
    mutationFn: customerApi.deleteCustomer,
    onSuccess: () => {
      toast.success('Customer dihapus')
      setDeletingCustomer(null)
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const rowsWithActions = React.useMemo(
    () =>
      (data || []).map((customer) => ({
        customer,
        actions: [
          {
            label: 'Edit',
            icon: Pencil,
            onClick: () => {
              setEditing(customer)
              setDialogOpen(true)
            },
          },
          { label: 'Hapus', icon: Trash2, variant: 'destructive', onClick: () => setDeletingCustomer(customer) },
        ] satisfies RowAction[],
      })),
    [data]
  )

  return (
    <div>
      <PageHeader
        title="Customer"
        description="Kelola daftar customer 22Studio"
        breadcrumbs={[{ label: 'Dashboard', to: '/admin' }, { label: 'Customer' }]}
        action={
          <Button
            onClick={() => {
              setEditing(undefined)
              setDialogOpen(true)
            }}
          >
            <Plus className="size-4" /> Tambah Customer
          </Button>
        }
      />

      <Card className="shadow-sm">
        <CardContent className="px-0">
          {isLoading ? (
            <div className="space-y-3 px-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <>
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Customer</TableHead>
                    <TableHead>PIC</TableHead>
                    <TableHead>No HP</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Artikel</TableHead>
                    <TableHead>Terakhir Order</TableHead>
                    <TableHead>Order Terakhir</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-muted-foreground text-center">
                        Belum ada data customer.
                      </TableCell>
                    </TableRow>
                  )}
                  {rowsWithActions.map(({ customer, actions }) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>{customer.pic || '-'}</TableCell>
                      <TableCell>{customer.no_hp || '-'}</TableCell>
                      <TableCell>{customer.category || '-'}</TableCell>
                      <TableCell className="max-w-48 truncate">
                        {(articleNamesByCustomer.get(customer.id) || []).join(', ') || '-'}
                      </TableCell>
                      <TableCell>{customer.terakhir_order ? formatDate(customer.terakhir_order) : '-'}</TableCell>
                      <TableCell className="max-w-40 truncate">{customer.order_terakhir || '-'}</TableCell>
                      <TableCell className="text-right">
                        <RowActionsMenu actions={actions} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {data?.length === 0 && (
                <p className="text-muted-foreground px-4 py-6 text-center text-sm md:hidden">
                  Belum ada data customer.
                </p>
              )}
              <MobileCardList className="p-4">
                {rowsWithActions.map(({ customer, actions }) => (
                  <MobileCard key={customer.id}>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-muted-foreground text-xs">{customer.pic || '-'}</p>
                      </div>
                      <RowActionsMenu actions={actions} />
                    </div>
                    <MobileCardRow label="No HP">{customer.no_hp || '-'}</MobileCardRow>
                    <MobileCardRow label="Category">{customer.category || '-'}</MobileCardRow>
                    <MobileCardRow label="Artikel">
                      {(articleNamesByCustomer.get(customer.id) || []).join(', ') || '-'}
                    </MobileCardRow>
                    <MobileCardRow label="Terakhir Order">
                      {customer.terakhir_order ? formatDate(customer.terakhir_order) : '-'}
                    </MobileCardRow>
                  </MobileCard>
                ))}
              </MobileCardList>
            </>
          )}
        </CardContent>
      </Card>

      <CustomerFormDialog customer={editing} open={dialogOpen} onOpenChange={setDialogOpen} />

      <AlertDialog open={!!deletingCustomer} onOpenChange={(open) => !open && setDeletingCustomer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Customer?</AlertDialogTitle>
            <AlertDialogDescription>
              Customer "{deletingCustomer?.name}" akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deletingCustomer && deleteMutation.mutate(deletingCustomer.id)}
            >
              {deleteMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
