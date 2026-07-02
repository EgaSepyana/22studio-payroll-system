import * as React from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
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
import * as workLogApi from '@/services/workLogApi'
import * as customerApi from '@/services/customerApi'
import * as articleApi from '@/services/articleApi'
import { getErrorMessage } from '@/services/api'
import { formatCurrency, todayISO, WORK_STATUS_OPTIONS } from '@/utils/format'

const schema = z.object({
  work_date: z.string().min(1, 'Tanggal wajib diisi'),
  customer_id: z.string().min(1, 'Customer wajib dipilih'),
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

  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: customerApi.listCustomers })
  const { data: articles } = useQuery({ queryKey: ['articles'], queryFn: articleApi.listArticles })

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      work_date: todayISO(),
      customer_id: '',
      article_id: '',
      quantity: undefined,
      notes: '',
      status: 'selesai',
    },
  })

  const customerId = form.watch('customer_id')
  const articleId = form.watch('article_id')
  const quantity = form.watch('quantity')

  const availableArticles = React.useMemo(
    () => articles?.filter((a) => a.customer_id === customerId && a.status === 'active') || [],
    [articles, customerId]
  )

  const selectedArticle = articles?.find((a) => a.id === articleId)
  const price = selectedArticle?.price || 0
  const total = price * (Number(quantity) || 0)

  React.useEffect(() => {
    form.setValue('article_id', '')
  }, [customerId, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      workLogApi.createWorkLog({
        work_date: values.work_date,
        customer_id: values.customer_id,
        article_id: values.article_id,
        quantity: values.quantity,
        notes: values.notes,
        status: values.status,
      }),
    onSuccess: () => {
      toast.success('Pekerjaan berhasil disimpan!')
      queryClient.invalidateQueries({ queryKey: ['worklogs-mine'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'employee'] })
      navigate('/app')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-heading text-xl font-semibold">Input Pekerjaan</h1>
        <p className="text-muted-foreground text-sm">Catat hasil pekerjaan yang sudah selesai.</p>
      </div>

      <Form {...form}>
        <form
          className="flex flex-col gap-5"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
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
            name="customer_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">Customer</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="h-12 w-full text-base">
                      <SelectValue placeholder="Pilih customer" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {customers?.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-base">
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
            name="article_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">Artikel</FormLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={!customerId}>
                  <FormControl>
                    <SelectTrigger className="h-12 w-full text-base">
                      <SelectValue placeholder={customerId ? 'Pilih artikel' : 'Pilih customer dahulu'} />
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

          {selectedArticle && (
            <Card className="border-primary/20 bg-primary/5 shadow-none">
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="text-muted-foreground text-xs">Harga per pcs</p>
                  <p className="text-sm font-medium">{formatCurrency(price)}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-xs">Total</p>
                  <p className="text-primary text-2xl font-bold">{formatCurrency(total)}</p>
                </div>
              </CardContent>
            </Card>
          )}

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

          <Button type="submit" size="lg" className="h-14 text-base" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-5 animate-spin" />}
            Simpan Pekerjaan
          </Button>
        </form>
      </Form>
    </div>
  )
}
