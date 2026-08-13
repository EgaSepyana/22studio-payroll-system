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
import * as articleCategoryApi from '@/services/articleCategoryApi'
import * as customerApi from '@/services/customerApi'
import { getErrorMessage } from '@/services/api'
import type { ArticleCategory } from '@/types'

const schema = z.object({
  name: z.string().min(1, 'Nama kategori wajib diisi'),
  customer_ids: z.array(z.string()),
})
type FormValues = z.output<typeof schema>

function CategoryFormDialog({
  category,
  open,
  onOpenChange,
}: {
  category?: ArticleCategory
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isEdit = !!category
  const queryClient = useQueryClient()
  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: customerApi.listCustomers })
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: category?.name || '', customer_ids: category?.customer_ids || [] },
  })

  React.useEffect(() => {
    if (open) {
      form.reset({ name: category?.name || '', customer_ids: category?.customer_ids || [] })
    }
  }, [open, category, form])

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const saved = isEdit
        ? await articleCategoryApi.updateArticleCategory(category.id, { name: values.name })
        : await articleCategoryApi.createArticleCategory({ name: values.name })
      await articleCategoryApi.setArticleCategoryCustomers(saved.id, values.customer_ids)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Kategori diperbarui' : 'Kategori ditambahkan')
      queryClient.invalidateQueries({ queryKey: ['article-categories'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Kategori' : 'Tambah Kategori'}</DialogTitle>
          <DialogDescription>Contoh: Kaos, Kemeja, Jaket.</DialogDescription>
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
                  <FormLabel>Nama Kategori</FormLabel>
                  <FormControl>
                    <Input placeholder="Nama kategori" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="customer_ids"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer</FormLabel>
                  <DropdownMenu>
                    <FormControl>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-normal">
                          {field.value.length === 0
                            ? 'Pilih customer'
                            : field.value.length === 1
                              ? customers?.find((c) => c.id === field.value[0])?.name || '1 customer dipilih'
                              : `${field.value.length} customer dipilih`}
                          <ChevronDown className="size-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                    </FormControl>
                    <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
                      {customers?.map((c) => {
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

export default function ArticleCategories() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ArticleCategory | undefined>(undefined)
  const [deletingCategory, setDeletingCategory] = React.useState<ArticleCategory | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['article-categories'],
    queryFn: articleCategoryApi.listArticleCategories,
  })

  const deleteMutation = useMutation({
    mutationFn: articleCategoryApi.deleteArticleCategory,
    onSuccess: () => {
      toast.success('Kategori dihapus')
      setDeletingCategory(null)
      queryClient.invalidateQueries({ queryKey: ['article-categories'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const rowsWithActions = React.useMemo(
    () =>
      (data || []).map((category) => ({
        category,
        actions: [
          {
            label: 'Edit',
            icon: Pencil,
            onClick: () => {
              setEditing(category)
              setDialogOpen(true)
            },
          },
          { label: 'Hapus', icon: Trash2, variant: 'destructive', onClick: () => setDeletingCategory(category) },
        ] satisfies RowAction[],
      })),
    [data]
  )

  return (
    <div>
      <PageHeader
        title="Kategori Artikel"
        description="Kelola kategori untuk mengelompokkan artikel"
        breadcrumbs={[{ label: 'Dashboard', to: '/admin' }, { label: 'Kategori Artikel' }]}
        action={
          <Button
            onClick={() => {
              setEditing(undefined)
              setDialogOpen(true)
            }}
          >
            <Plus className="size-4" /> Tambah Kategori
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
                    <TableHead>Nama Kategori</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground text-center">
                        Belum ada data kategori.
                      </TableCell>
                    </TableRow>
                  )}
                  {rowsWithActions.map(({ category, actions }) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {category.customer_names.filter(Boolean).join(', ') || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <RowActionsMenu actions={actions} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {data?.length === 0 && (
                <p className="text-muted-foreground px-4 py-6 text-center text-sm md:hidden">
                  Belum ada data kategori.
                </p>
              )}
              <MobileCardList className="p-4">
                {rowsWithActions.map(({ category, actions }) => (
                  <MobileCard key={category.id}>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="font-medium">{category.name}</p>
                      <RowActionsMenu actions={actions} />
                    </div>
                    <MobileCardRow label="Customer">
                      {category.customer_names.filter(Boolean).join(', ') || '-'}
                    </MobileCardRow>
                  </MobileCard>
                ))}
              </MobileCardList>
            </>
          )}
        </CardContent>
      </Card>

      <CategoryFormDialog category={editing} open={dialogOpen} onOpenChange={setDialogOpen} />

      <AlertDialog open={!!deletingCategory} onOpenChange={(open) => !open && setDeletingCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kategori?</AlertDialogTitle>
            <AlertDialogDescription>
              Kategori "{deletingCategory?.name}" akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deletingCategory && deleteMutation.mutate(deletingCategory.id)}
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
