import * as React from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { ProgressBar } from '@/components/ProgressBar'
import { LembarPOPreviewDialog } from '@/components/LembarPOPreviewDialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import * as workLogApi from '@/services/workLogApi'
import * as taskApi from '@/services/taskApi'
import * as articleApi from '@/services/articleApi'
import * as lembarPOApi from '@/services/lembarPOApi'
import { getErrorMessage } from '@/services/api'
import { formatCurrency, todayISO, WORK_STATUS_OPTIONS } from '@/utils/format'

const schema = z.object({
  work_date: z.string().min(1, 'Tanggal wajib diisi'),
  task_id: z.string().min(1, 'Task wajib dipilih'),
  article_id: z.string().min(1, 'Artikel wajib dipilih'),
  quantity: z.coerce.number().positive('Quantity harus lebih dari 0'),
  notes: z.string().optional(),
  status: z.enum(['on_progress', 'selesai', 'belum_selesai']),
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

export default function InputPekerjaan() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: divisiTasks } = useQuery({ queryKey: ['tasks-available'], queryFn: taskApi.listAvailableTasks })
  const activeTasks = React.useMemo(() => divisiTasks || [], [divisiTasks])
  const { data: articles } = useQuery({ queryKey: ['articles'], queryFn: () => articleApi.listArticles() })

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      work_date: todayISO(),
      task_id: '',
      article_id: '',
      quantity: undefined,
      notes: '',
      status: 'selesai',
    },
  })

  const taskId = form.watch('task_id')
  const selectedTask = activeTasks.find((t) => t.id === taskId)
  const [lembarPOOpen, setLembarPOOpen] = React.useState(false)

  // Existence-only check so the button can stay hidden when the order has no
  // Lembar PO yet — shares its cache with the dialog's own query (same key),
  // so opening the dialog after this resolves is instant, no second fetch.
  const { data: lembarPO } = useQuery({
    queryKey: ['lembar-po-by-order', selectedTask?.order_id],
    queryFn: () => lembarPOApi.getLembarPOByOrder(selectedTask!.order_id),
    enabled: !!selectedTask?.order_id,
    retry: false,
  })
  const availableArticles = React.useMemo(
    () =>
      articles?.filter(
        (a) =>
          !!selectedTask?.customer_id &&
          a.customer_ids.includes(selectedTask.customer_id) &&
          (!a.divisi || a.divisi === selectedTask?.divisi)
      ) || [],
    [articles, selectedTask]
  )
  const articleId = form.watch('article_id')
  const selectedArticle = availableArticles.find((a) => a.id === articleId)

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      workLogApi.createWorkLog({
        work_date: values.work_date,
        task_id: values.task_id,
        article_id: values.article_id,
        quantity: values.quantity,
        notes: values.notes,
        status: values.status,
      }),
    onSuccess: () => {
      toast.success('Pekerjaan berhasil disimpan!')
      queryClient.invalidateQueries({ queryKey: ['worklogs-mine'] })
      queryClient.invalidateQueries({ queryKey: ['tasks-available'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'employee'] })
      navigate('/app')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  function onSubmit(values: FormValues) {
    if (selectedTask && values.quantity > selectedTask.remaining_qty) {
      form.setError('quantity', {
        message: `Quantity melebihi sisa target task (sisa ${selectedTask.remaining_qty})`,
      })
      return
    }
    mutation.mutate(values)
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-heading text-xl font-semibold">Input Pekerjaan</h1>
        <p className="text-muted-foreground text-sm">Catat hasil pekerjaan yang sudah selesai.</p>
      </div>

      {activeTasks.length === 0 && (
        <Card className="border-warning/30 bg-warning/5 shadow-none">
          <CardContent className="text-muted-foreground py-4 text-sm">
            Belum ada task untuk divisimu. Hubungi admin untuk menambahkan task.
          </CardContent>
        </Card>
      )}

      <Form {...form}>
        <form className="flex flex-col gap-5" onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="work_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">Tanggal</FormLabel>
                <FormControl>
                  <Input type="date" className="h-12 text-base" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="task_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">Task</FormLabel>
                <Combobox
                  items={activeTasks}
                  itemToStringLabel={(t) =>
                    `${t.customer_name ? `${t.customer_name} - ` : ''}${t.order_name} — ${t.description || t.divisi}`
                  }
                  value={activeTasks.find((t) => t.id === field.value) ?? null}
                  onValueChange={(t) => {
                    field.onChange(t ? t.id : '')
                    form.setValue('article_id', '')
                  }}
                  disabled={activeTasks.length === 0}
                >
                  <FormControl>
                    <ComboboxInput placeholder="Cari task..." className="h-12 w-full text-base" />
                  </FormControl>
                  <ComboboxContent>
                    <ComboboxEmpty>Task tidak ditemukan.</ComboboxEmpty>
                    <ComboboxList>
                      {(t: (typeof activeTasks)[number]) => (
                        <ComboboxItem key={t.id} value={t}>
                          {t.customer_name ? `${t.customer_name} - ` : ''}
                          {t.order_name} — {t.description || t.divisi}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                <FormMessage />
              </FormItem>
            )}
          />

          {selectedTask && (
            <Card className="border-primary/20 bg-primary/5 shadow-none">
              <CardContent className="flex flex-col gap-2 py-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="font-medium">{selectedTask.customer_name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sisa Target</span>
                  <span className="font-medium">{selectedTask.remaining_qty} / {selectedTask.target_qty}</span>
                </div>
                <ProgressBar value={selectedTask.progress} status={selectedTask.status} className="mt-1" />
                {lembarPO && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-1 self-start"
                    onClick={() => setLembarPOOpen(true)}
                  >
                    <FileText className="size-4" /> Lihat Lembar PO
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          <FormField
            control={form.control}
            name="article_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">Artikel</FormLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={!selectedTask}>
                  <FormControl>
                    <SelectTrigger className="h-12 w-full text-base">
                      <SelectValue placeholder={!selectedTask ? 'Pilih task dahulu' : 'Pilih artikel'} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableArticles.map((a) => (
                      <SelectItem key={a.id} value={a.id} className="text-base">
                        {a.article_name} — {formatCurrency(a.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTask && availableArticles.length === 0 && (
                  <p className="text-muted-foreground text-xs">Belum ada artikel untuk customer pada task ini.</p>
                )}
                {selectedArticle && (
                  <p className="text-muted-foreground text-xs">
                    Harga: <span className="font-medium">{formatCurrency(selectedArticle.price)}</span> / pcs
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">Quantity</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={selectedTask?.remaining_qty}
                    placeholder="0"
                    className="h-16 text-center text-3xl font-semibold"
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
                <FormLabel className="text-base">Status Pekerjaan</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="h-12 w-full text-base">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {WORK_STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-base">
                        {opt.label}
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
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">Keterangan (opsional)</FormLabel>
                <FormControl>
                  <Textarea placeholder="Catatan tambahan..." className="text-base" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            size="lg"
            className="h-14 text-base"
            disabled={mutation.isPending || activeTasks.length === 0}
          >
            {mutation.isPending && <Loader2 className="size-5 animate-spin" />}
            Simpan Pekerjaan
          </Button>
        </form>
      </Form>

      <LembarPOPreviewDialog
        orderId={selectedTask?.order_id ?? null}
        open={lembarPOOpen}
        onOpenChange={setLembarPOOpen}
      />
    </div>
  )
}
