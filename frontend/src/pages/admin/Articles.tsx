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
import { Badge } from '@/components/ui/badge'
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
import * as articleApi from '@/services/articleApi'
import * as customerApi from '@/services/customerApi'
import { getErrorMessage } from '@/services/api'
import { formatCurrency } from '@/utils/format'
import type { Article, Divisi } from '@/types'

const DIVISIONS: Divisi[] = ['Jahit', 'Sablon', 'Cutting', 'Finishing']
const ALL = 'all'

const schema = z.object({
  customer_id: z.string().min(1, 'Customer wajib dipilih'),
  article_name: z.string().min(1, 'Nama artikel wajib diisi'),
  price: z.coerce.number().positive('Harga harus lebih dari 0'),
  status: z.enum(['active', 'inactive']),
  divisi: z.enum(['Jahit', 'Sablon', 'Cutting', 'Finishing']),
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

function ArticleFormDialog({
  article,
  open,
  onOpenChange,
}: {
  article?: Article
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isEdit = !!article
  const queryClient = useQueryClient()
  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: customerApi.listCustomers })

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      customer_id: article?.customer_id || '',
      article_name: article?.article_name || '',
      price: article?.price || 0,
      status: article?.status || 'active',
      divisi: article?.divisi || 'Jahit',
    },
  })

  React.useEffect(() => {
    if (open) {
      form.reset({
        customer_id: article?.customer_id || '',
        article_name: article?.article_name || '',
        price: article?.price || 0,
        status: article?.status || 'active',
        divisi: article?.divisi || 'Jahit',
      })
    }
  }, [open, article, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEdit ? articleApi.updateArticle(article.id, values) : articleApi.createArticle(values),
    onSuccess: () => {
      toast.success(isEdit ? 'Artikel diperbarui' : 'Artikel ditambahkan')
      queryClient.invalidateQueries({ queryKey: ['articles'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Artikel' : 'Tambah Artikel'}</DialogTitle>
          <DialogDescription>Contoh: Fullprint 3 Warna — Rp3.500/pcs.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <FormField
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih customer" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {customers?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="article_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Artikel</FormLabel>
                  <FormControl>
                    <Input placeholder="Nama artikel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Harga per pcs</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="3500"
                        {...field}
                        value={(field.value ?? '') as string | number}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Aktif</SelectItem>
                        <SelectItem value="inactive">Nonaktif</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="divisi"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Divisi</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DIVISIONS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

export default function Articles() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Article | undefined>(undefined)
  const [divisiFilter, setDivisiFilter] = React.useState<string>(ALL)

  const filters = { divisi: divisiFilter === ALL ? undefined : (divisiFilter as Divisi) }

  const { data, isLoading } = useQuery({
    queryKey: ['articles', filters],
    queryFn: () => articleApi.listArticles(filters),
  })

  const deleteMutation = useMutation({
    mutationFn: articleApi.deleteArticle,
    onSuccess: () => {
      toast.success('Artikel dihapus')
      queryClient.invalidateQueries({ queryKey: ['articles'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <div>
      <PageHeader
        title="Artikel"
        description="Kelola artikel dan harga per customer"
        breadcrumbs={[{ label: 'Dashboard', to: '/admin' }, { label: 'Artikel' }]}
        action={
          <Button
            onClick={() => {
              setEditing(undefined)
              setDialogOpen(true)
            }}
          >
            <Plus className="size-4" /> Tambah Artikel
          </Button>
        }
      />

      <Card className="mb-4 shadow-sm">
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Divisi</label>
            <Select value={divisiFilter} onValueChange={setDivisiFilter}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua Divisi</SelectItem>
                {DIVISIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

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
                  <TableHead>Customer</TableHead>
                  <TableHead>Nama Artikel</TableHead>
                  <TableHead>Divisi</TableHead>
                  <TableHead>Harga</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground text-center">
                      Belum ada data artikel.
                    </TableCell>
                  </TableRow>
                )}
                {data?.map((article) => (
                  <TableRow key={article.id}>
                    <TableCell>{article.customer_name}</TableCell>
                    <TableCell className="font-medium">{article.article_name}</TableCell>
                    <TableCell>
                      {article.divisi ? <Badge variant="outline">{article.divisi}</Badge> : '-'}
                    </TableCell>
                    <TableCell>{formatCurrency(article.price)}</TableCell>
                    <TableCell>
                      <Badge variant={article.status === 'active' ? 'default' : 'secondary'}>
                        {article.status === 'active' ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(article)
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
                            <AlertDialogTitle>Hapus Artikel?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Artikel "{article.article_name}" akan dihapus permanen.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-white hover:bg-destructive/90"
                              onClick={() => deleteMutation.mutate(article.id)}
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

      <ArticleFormDialog article={editing} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
