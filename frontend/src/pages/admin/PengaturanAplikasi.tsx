import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Pencil } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
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
import * as settingsApi from '@/services/settingsApi'
import { getErrorMessage } from '@/services/api'
import type { WATemplate, WATemplateKey } from '@/types'

// Reference list of placeholders available per template, shown as a helper
// while editing — purely informational, not enforced (admin can still type
// anything; unrecognized {TOKENS} are just left as-is when resolved).
const TEMPLATE_PLACEHOLDERS: Record<WATemplateKey, string[]> = {
  invoice: [
    'SALAM', 'NAMA', 'NAMA_USAHA', 'NO_INVOICE', 'ALAMAT', 'ORDER', 'RINCIAN',
    'TOTAL_BRUTO', 'DP_MIN', 'REKENING_BANK', 'CATATAN',
  ],
  payment_confirmation: [
    'NAMA_USAHA', 'NO_INVOICE', 'NAMA', 'ALAMAT', 'ORDER', 'TOTAL', 'BAYAR',
    'SISA', 'DEADLINE', 'DP_HISTORY', 'REKENING_BANK',
  ],
  production_started: ['SALAM', 'NAMA', 'NO_INVOICE', 'ORDER'],
  order_completed: ['NAMA', 'ORDER', 'NO_INVOICE', 'SISA', 'NAMA_USAHA'],
  payment_reminder: ['SALAM', 'NAMA', 'NO_INVOICE', 'ORDER', 'SISA', 'REKENING_BANK'],
  picked_up: ['NAMA', 'NO_INVOICE', 'ORDER', 'DISTRIBUSI', 'DITERIMA'],
  qc_report: ['SALAM', 'ORDER', 'NAMA', 'NO_INVOICE', 'QTY_PO', 'QTY_QC', 'QTY_SELISIH', 'STATUS'],
  design_confirmation: ['SALAM', 'NAMA', 'NO_INVOICE', 'LINK_TRACKING'],
}

function TemplateEditDialog({
  template,
  onOpenChange,
}: {
  template: WATemplate | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [content, setContent] = React.useState('')

  React.useEffect(() => {
    if (template) setContent(template.content)
  }, [template])

  const mutation = useMutation({
    mutationFn: () => settingsApi.updateWATemplate(template!.template_key, { content }),
    onSuccess: () => {
      toast.success('Template berhasil diperbarui')
      queryClient.invalidateQueries({ queryKey: ['wa-templates'] })
      onOpenChange(false)
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Dialog open={!!template} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{template?.label}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={14}
            className="font-mono text-xs"
          />
          {template && (
            <div className="text-muted-foreground text-xs">
              <p className="mb-1 font-medium">Placeholder tersedia:</p>
              <p className="font-mono">
                {TEMPLATE_PLACEHOLDERS[template.template_key].map((p) => `{${p}}`).join(', ')}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BankAccountSection() {
  const queryClient = useQueryClient()
  const [value, setValue] = React.useState('')
  const [dirty, setDirty] = React.useState(false)

  const { data, isLoading } = useQuery({ queryKey: ['bank-account'], queryFn: settingsApi.getBankAccount })

  React.useEffect(() => {
    if (data !== undefined && !dirty) setValue(data)
  }, [data, dirty])

  const mutation = useMutation({
    mutationFn: () => settingsApi.updateBankAccount(value),
    onSuccess: () => {
      toast.success('Rekening bank berhasil disimpan')
      setDirty(false)
      queryClient.invalidateQueries({ queryKey: ['bank-account'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Card className="shadow-sm">
      <CardContent className="flex flex-col gap-3">
        <div>
          <h3 className="font-heading text-sm font-semibold">Rekening Bank</h3>
          <p className="text-muted-foreground text-xs">
            Ditampilkan pada template yang memakai placeholder {'{REKENING_BANK}'}.
          </p>
        </div>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <Textarea
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setDirty(true)
            }}
            rows={4}
            placeholder={'Contoh:\nBCA 1234567890 a.n. 22Studio\nMandiri 0987654321 a.n. 22Studio'}
          />
        )}
        <Button
          size="sm"
          className="w-fit"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || isLoading}
        >
          {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
          Simpan
        </Button>
      </CardContent>
    </Card>
  )
}

function WATemplatesSection() {
  const [editingTemplate, setEditingTemplate] = React.useState<WATemplate | null>(null)
  const { data, isLoading } = useQuery({ queryKey: ['wa-templates'], queryFn: settingsApi.listWATemplates })

  return (
    <Card className="shadow-sm">
      <CardContent className="flex flex-col gap-3">
        <div>
          <h3 className="font-heading text-sm font-semibold">Template WhatsApp Follow Up</h3>
          <p className="text-muted-foreground text-xs">
            Dipakai pada aksi "Follow Up WA" di halaman Order.
          </p>
        </div>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col divide-y">
            {data?.map((tpl) => (
              <div key={tpl.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{tpl.label}</p>
                  <p className="text-muted-foreground truncate text-xs">{tpl.content.slice(0, 80)}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setEditingTemplate(tpl)}>
                  <Pencil className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <TemplateEditDialog template={editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)} />
    </Card>
  )
}

export default function PengaturanAplikasi() {
  return (
    <div>
      <PageHeader
        title="Pengaturan Aplikasi"
        description="Kelola rekening bank dan template WhatsApp follow up"
        breadcrumbs={[{ label: 'Dashboard', to: '/admin' }, { label: 'Pengaturan Aplikasi' }]}
      />

      <div className="flex flex-col gap-4">
        <BankAccountSection />
        <WATemplatesSection />
      </div>
    </div>
  )
}
