import * as React from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Loader2, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import * as suratJalanApi from '@/services/suratJalanApi'
import * as customerApi from '@/services/customerApi'
import { getErrorMessage } from '@/services/api'
import { formatDate } from '@/utils/format'

const schema = z.object({
  customer_id: z.string().min(1, 'Customer wajib dipilih'),
  penerima_nama: z.string().optional(),
  penerima_telepon: z.string().optional(),
  penerima_alamat: z.string().optional(),
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

function CreateSuratJalanDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: customerApi.listCustomers })

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { customer_id: '', penerima_nama: '', penerima_telepon: '', penerima_alamat: '' },
  })

  React.useEffect(() => {
    if (open) form.reset({ customer_id: '', penerima_nama: '', penerima_telepon: '', penerima_alamat: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => suratJalanApi.createSuratJalan(values),
    onSuccess: (result) => {
      toast.success('Surat Jalan berhasil ditambahkan')
      queryClient.invalidateQueries({ queryKey: ['surat-jalan'] })
      onOpenChange(false)
      navigate(`/app/surat-jalan/${result.id}`)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Surat Jalan</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="flex flex-col gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <FormField
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-12 w-full text-base"><SelectValue placeholder="Pilih customer" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {customers?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="penerima_nama"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Penerima</FormLabel>
                  <FormControl><Input className="h-12 text-base" placeholder="Nama penerima barang" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="penerima_telepon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telepon Penerima</FormLabel>
                  <FormControl><Input className="h-12 text-base" placeholder="08xx-xxxx-xxxx" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="penerima_alamat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alamat Penerima</FormLabel>
                  <FormControl><Textarea placeholder="Alamat lengkap tujuan pengiriman" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" className="h-12 w-full text-base" disabled={mutation.isPending}>
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

export default function SuratJalan() {
  const navigate = useNavigate()
  const [formOpen, setFormOpen] = React.useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['surat-jalan', {}],
    queryFn: () => suratJalanApi.listSuratJalan(),
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold">Surat Jalan</h1>
          <p className="text-muted-foreground text-sm">Kelola surat jalan pengiriman barang ke customer.</p>
        </div>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="size-4" /> Tambah
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : data?.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">Belum ada surat jalan.</p>
        ) : (
          data?.map((row) => (
            <Card
              key={row.id}
              className="cursor-pointer shadow-sm"
              onClick={() => navigate(`/app/surat-jalan/${row.id}`)}
            >
              <CardContent className="flex items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{row.no_document}</p>
                  <p className="text-muted-foreground text-xs">{row.customer_name}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatDate(row.created_at)} — {row.item_count} item
                  </p>
                </div>
                <ChevronRight className="text-muted-foreground size-4 shrink-0" />
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <CreateSuratJalanDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  )
}
