import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Edit2, Loader2 } from 'lucide-react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { WorkStatusBadge } from '@/components/WorkStatusBadge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import * as workLogApi from '@/services/workLogApi'
import * as customerApi from '@/services/customerApi'
import * as articleApi from '@/services/articleApi'
import { getErrorMessage } from '@/services/api'
import { formatCurrency, formatDate, WORK_STATUS_OPTIONS } from '@/utils/format'
import type { WorkLog } from '@/types'

const formSchema = z.object({
  work_date: z.string().min(1, 'Tanggal wajib diisi'),
  customer_id: z.string().min(1, 'Customer wajib dipilih'),
  article_id: z.string().min(1, 'Artikel wajib dipilih'),
  quantity: z.coerce.number().positive('Quantity harus lebih dari 0'),
  notes: z.string().optional(),
  status: z.enum(['on_progress', 'selesai', 'belum_selesai']),
})
type FormInput = z.input<typeof formSchema>
type FormValues = z.output<typeof formSchema>

export default function RiwayatPekerjaan() {
  const queryClient = useQueryClient()
  const [dateFrom, setDateFrom] = React.useState('')
  const [dateTo, setDateTo] = React.useState('')
  const [editingLog, setEditingLog] = React.useState<WorkLog | null>(null)

  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: customerApi.listCustomers })
  const { data: articles } = useQuery({ queryKey: ['articles'], queryFn: () => articleApi.listArticles() })

  const filters = { date_from: dateFrom || undefined, date_to: dateTo || undefined }

  const { data, isLoading } = useQuery({
    queryKey: ['worklogs-mine', filters],
    queryFn: () => workLogApi.listMyWorkLogs(filters),
  })

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { work_date: '', customer_id: '', article_id: '', quantity: undefined, notes: '', status: 'selesai' },
  })

  const formCustomerId = form.watch('customer_id')
  const availableArticles = React.useMemo(
    () => articles?.filter((a) => a.customer_id === formCustomerId && a.status === 'active') || [],
    [articles, formCustomerId]
  )

  const openEdit = (log: WorkLog) => {
    form.reset({
      work_date: log.work_date,
      customer_id: log.customer_id,
      article_id: log.article_id,
      quantity: log.quantity,
      notes: log.notes || '',
      status: log.status || 'selesai',
    })
    setEditingLog(log)
  }

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) => workLogApi.updateWorkLog(editingLog!.id, values),
    onSuccess: () => {
      toast.success('Pekerjaan berhasil diubah')
      setEditingLog(null)
      queryClient.invalidateQueries({ queryKey: ['worklogs-mine'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-semibold">Riwayat Pekerjaan</h1>
        <p className="text-muted-foreground text-sm">Daftar pekerjaan yang sudah kamu input.</p>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-muted-foreground text-xs font-medium">Dari</label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-muted-foreground text-xs font-medium">Sampai</label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        {(dateFrom || dateTo) && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setDateFrom('')
              setDateTo('')
            }}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : data?.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">Belum ada pekerjaan tercatat.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {data?.map((log) => (
            <Card key={log.id} className="shadow-sm">
              <CardContent className="flex items-center justify-between py-4 gap-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{log.article_name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {log.customer_name} &middot; {formatDate(log.work_date)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {log.quantity} pcs &times; {formatCurrency(log.price)}
                  </p>
                  <div className="mt-1.5">
                    <WorkStatusBadge status={log.status} />
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0 gap-1">
                  <p className="text-base font-semibold">{formatCurrency(log.total)}</p>
                  {!log.payroll_id ? (
                     <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openEdit(log)}>
                       <Edit2 className="mr-1.5 size-3" /> Edit
                     </Button>
                  ) : (
                     <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold bg-muted px-2 py-0.5 rounded">Dibayar</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editingLog} onOpenChange={(open) => !open && setEditingLog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Pekerjaan</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => updateMutation.mutate(v))} className="space-y-4">
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
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status Pekerjaan</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {WORK_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Simpan Perubahan
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
