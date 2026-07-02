import * as React from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { CashAdvanceStatusBadge } from '@/components/CashAdvanceStatusBadge'
import * as cashAdvanceApi from '@/services/cashAdvanceApi'
import { getErrorMessage } from '@/services/api'
import { formatCurrency, formatDate, CASH_ADVANCE_STATUS_OPTIONS } from '@/utils/format'
import type { CashAdvanceStatus } from '@/types'

const ALL = 'all'

const schema = z.object({
  amount: z.coerce.number().positive('Nominal harus lebih dari Rp0'),
  reason: z.string().optional(),
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

export default function Kasbon() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = React.useState<CashAdvanceStatus | typeof ALL>(ALL)

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: undefined, reason: '' },
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) => cashAdvanceApi.createCashAdvance(values),
    onSuccess: () => {
      toast.success('Pengajuan kasbon berhasil dikirim')
      form.reset({ amount: undefined, reason: '' })
      queryClient.invalidateQueries({ queryKey: ['kasbon-mine'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const filters = { status: statusFilter === ALL ? undefined : statusFilter }
  const { data, isLoading } = useQuery({
    queryKey: ['kasbon-mine', filters],
    queryFn: () => cashAdvanceApi.listMyCashAdvances(filters),
  })

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-semibold">Kasbon</h1>
        <p className="text-muted-foreground text-sm">Ajukan kasbon dan lihat riwayat pengajuanmu.</p>
      </div>

      <Tabs defaultValue="ajukan">
        <TabsList className="w-full">
          <TabsTrigger value="ajukan" className="flex-1">Ajukan Kasbon</TabsTrigger>
          <TabsTrigger value="riwayat" className="flex-1">Riwayat Kasbon</TabsTrigger>
        </TabsList>

        <TabsContent value="ajukan" className="mt-4">
          <Card className="shadow-sm">
            <CardContent>
              <Form {...form}>
                <form
                  className="flex flex-col gap-4"
                  onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
                >
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Nominal Kasbon</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            placeholder="200000"
                            className="h-14 text-center text-2xl font-semibold"
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
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Alasan (opsional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Keperluan pribadi..." className="text-base" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" size="lg" className="h-12 text-base" disabled={mutation.isPending}>
                    {mutation.isPending && <Loader2 className="size-5 animate-spin" />}
                    Ajukan Kasbon
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="riwayat" className="mt-4 flex flex-col gap-3">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CashAdvanceStatus | typeof ALL)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Semua Status</SelectItem>
              {CASH_ADVANCE_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : data?.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">Belum ada riwayat kasbon.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {data?.map((row) => (
                <Card key={row.id} className="shadow-sm">
                  <CardContent className="flex items-start justify-between gap-3 py-4">
                    <div className="min-w-0">
                      <p className="text-lg font-semibold">{formatCurrency(row.amount)}</p>
                      <p className="text-muted-foreground text-xs">{formatDate(row.requested_at)}</p>
                      {row.reason && <p className="text-muted-foreground mt-1 text-xs">{row.reason}</p>}
                    </div>
                    <CashAdvanceStatusBadge status={row.status} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
