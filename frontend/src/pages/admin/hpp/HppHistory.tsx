import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
import * as hppApi from '@/services/hppApi'
import { getErrorMessage } from '@/services/api'
import { formatCurrency, formatDateTime } from '@/utils/format'
import type { HppCalculation, HppCalculationSummary, HppCalculationTab } from '@/types'

const TAB_LABEL: Record<HppCalculationTab, string> = {
  kaos: 'Kaos Polos',
  produk: 'Produk Konveksi',
  sablon: 'Sablon',
  gabung: 'Paket',
}

export function HppHistory({ onLoad }: { onLoad: (calculation: HppCalculation) => void }) {
  const queryClient = useQueryClient()
  const [loadingId, setLoadingId] = React.useState<string | null>(null)
  const [deleting, setDeleting] = React.useState<HppCalculationSummary | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['hpp-calculations'], queryFn: hppApi.listCalculations })

  async function load(id: string) {
    setLoadingId(id)
    try {
      onLoad(await hppApi.getCalculation(id))
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoadingId(null)
    }
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => hppApi.removeCalculation(id),
    onSuccess: () => {
      toast.success('Perhitungan dihapus')
      setDeleting(null)
      queryClient.invalidateQueries({ queryKey: ['hpp-calculations'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Card className="mt-4 shadow-sm">
      <CardHeader>
        <CardTitle>Riwayat Perhitungan Tersimpan</CardTitle>
        <p className="text-muted-foreground text-sm">
          Tersimpan di Google Sheets dan terlihat oleh admin dan owner (50 terbaru).
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">Belum ada perhitungan yang disimpan.</p>
        ) : (
          <div className="flex flex-col divide-y">
            {data.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{TAB_LABEL[c.tab] ?? c.tab}</Badge>
                    <span className="truncate text-sm font-medium">{c.name || 'Tanpa nama'}</span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {formatDateTime(c.created_at)} · {c.created_by} · {c.qty} pcs · {formatCurrency(c.hpp)}/pcs
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" disabled={loadingId === c.id} onClick={() => load(c.id)}>
                    {loadingId === c.id && <Loader2 className="size-4 animate-spin" />}
                    Muat
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label="Hapus perhitungan" onClick={() => setDeleting(c)}>
                    <Trash2 className="text-destructive size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus perhitungan tersimpan?</AlertDialogTitle>
            <AlertDialogDescription>{deleting?.name || 'Tanpa nama'} akan dihapus dari riwayat.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteMutation.mutate(deleting.id)}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
