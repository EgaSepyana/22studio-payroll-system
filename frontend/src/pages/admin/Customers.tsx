import * as React from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: customer?.name || '',
      pic: customer?.pic || '',
      alamat: customer?.alamat || '',
      no_hp: customer?.no_hp || '',
      category: customer?.category || '',
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
      })
    }
  }, [open, customer, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        ...values,
        category: values.category || undefined,
      } as customerApi.CustomerInput
      return isEdit ? customerApi.updateCustomer(customer.id, payload) : customerApi.createCustomer(payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Customer diperbarui' : 'Customer ditambahkan')
      queryClient.invalidateQueries({ queryKey: ['customers'] })
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
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

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
            <Table>
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
                {data?.map((customer) => (
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(customer)
                          setDialogOpen(true)
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="text-destructive size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Hapus Customer?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Customer "{customer.name}" akan dihapus permanen.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-white hover:bg-destructive/90"
                              onClick={() => deleteMutation.mutate(customer.id)}
                            >
                              Hapus
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CustomerFormDialog customer={editing} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
