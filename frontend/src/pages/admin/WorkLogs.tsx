import * as React from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { X, Plus, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { getErrorMessage } from '@/services/api'
import { todayISO } from '@/utils/format'

import * as workLogApi from '@/services/workLogApi'
import * as employeeApi from '@/services/employeeApi'
import * as customerApi from '@/services/customerApi'
import * as articleApi from '@/services/articleApi'
import { formatCurrency, formatDate } from '@/utils/format'

const ALL = 'all'

const formSchema = z.object({
  employee_id: z.string().min(1, 'Karyawan wajib dipilih'),
  work_date: z.string().min(1, 'Tanggal wajib diisi'),
  customer_id: z.string().min(1, 'Customer wajib dipilih'),
  article_id: z.string().min(1, 'Artikel wajib dipilih'),
  quantity: z.coerce.number().positive('Quantity harus lebih dari 0'),
  notes: z.string().optional(),
})
type FormInput = z.input<typeof formSchema>
type FormValues = z.output<typeof formSchema>

export default function WorkLogs() {
  const queryClient = useQueryClient()
  const [dateFrom, setDateFrom] = React.useState('')
  const [dateTo, setDateTo] = React.useState('')
  const [employeeId, setEmployeeId] = React.useState(ALL)
  const [customerId, setCustomerId] = React.useState(ALL)
  const [articleId, setArticleId] = React.useState(ALL)
  const [isAddOpen, setIsAddOpen] = React.useState(false)

  const { data: employees } = useQuery({ queryKey: ['employees'], queryFn: employeeApi.listEmployees })
  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: customerApi.listCustomers })
  const { data: articles } = useQuery({ queryKey: ['articles'], queryFn: articleApi.listArticles })

  const filters = {
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    employee_id: employeeId === ALL ? undefined : employeeId,
    customer_id: customerId === ALL ? undefined : customerId,
    article_id: articleId === ALL ? undefined : articleId,
  }

  const { data, isLoading } = useQuery({
    queryKey: ['worklogs', filters],
    queryFn: () => workLogApi.listAllWorkLogs(filters),
  })

  const hasFilters = dateFrom || dateTo || employeeId !== ALL || customerId !== ALL || articleId !== ALL

  function resetFilters() {
    setDateFrom('')
    setDateTo('')
    setEmployeeId(ALL)
    setCustomerId(ALL)
    setArticleId(ALL)
  }

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { employee_id: '', work_date: todayISO(), customer_id: '', article_id: '', quantity: undefined, notes: '' },
  })
  
  const formCustomerId = form.watch('customer_id')
  const availableArticles = React.useMemo(
    () => articles?.filter((a) => a.customer_id === formCustomerId && a.status === 'active') || [],
    [articles, formCustomerId]
  )

  React.useEffect(() => {
    form.setValue('article_id', '')
  }, [formCustomerId, form])

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => workLogApi.createWorkLog(values),
    onSuccess: () => {
      toast.success('Pekerjaan berhasil ditambahkan')
      setIsAddOpen(false)
      form.reset()
      queryClient.invalidateQueries({ queryKey: ['worklogs'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const totalQty = data?.reduce((s, l) => s + l.quantity, 0) || 0
  const totalAmount = data?.reduce((s, l) => s + l.total, 0) || 0

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <PageHeader title="Data Pekerjaan" description="Seluruh pekerjaan yang diinput karyawan" />
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus className="mr-2 size-4" />
          Tambah Pekerjaan
        </Button>
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Pekerjaan</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
              <FormField control={form.control} name="employee_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Karyawan</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Pilih karyawan" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {employees?.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="work_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanggal</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="customer_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Pilih customer" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {customers?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="article_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Artikel</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={!formCustomerId}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Pilih artikel" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {availableArticles.map((a) => <SelectItem key={a.id} value={a.id}>{a.article_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="quantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl><Input type="number" min={1} {...field} value={(field.value ?? '') as string | number} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Keterangan</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="pt-2 flex justify-end">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Simpan
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Card className="mb-4 shadow-sm">
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Dari Tanggal</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Sampai Tanggal</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Karyawan</label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua Karyawan</SelectItem>
                {employees?.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Customer</label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua Customer</SelectItem>
                {customers?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Artikel</label>
            <Select value={articleId} onValueChange={setArticleId}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua Artikel</SelectItem>
                {articles?.map((a) => <SelectItem key={a.id} value={a.id}>{a.article_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {hasFilters && (
            <Button variant="ghost" onClick={resetFilters}>
              <X className="size-4" /> Reset
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="px-0">
          {isLoading ? (
            <div className="space-y-3 px-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Artikel</TableHead>
                  <TableHead>Harga</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Keterangan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground text-center">
                      Tidak ada data pekerjaan.
                    </TableCell>
                  </TableRow>
                )}
                {data?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{formatDate(log.work_date)}</TableCell>
                    <TableCell className="font-medium">{log.employee_name}</TableCell>
                    <TableCell>{log.customer_name}</TableCell>
                    <TableCell>{log.article_name}</TableCell>
                    <TableCell>{formatCurrency(log.price)}</TableCell>
                    <TableCell>{log.quantity}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(log.total)}</TableCell>
                    <TableCell className="text-muted-foreground max-w-40 truncate">
                      {log.notes || '-'}
                    </TableCell>
                  </TableRow>
                ))}
                {data && data.length > 0 && (
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={5}>Total</TableCell>
                    <TableCell>{totalQty}</TableCell>
                    <TableCell>{formatCurrency(totalAmount)}</TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
