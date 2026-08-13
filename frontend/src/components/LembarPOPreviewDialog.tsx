import { useQuery } from '@tanstack/react-query'
import { Loader2, FileWarning } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import * as lembarPOApi from '@/services/lembarPOApi'
import { formatDate } from '@/utils/format'

// Read-only preview of a Lembar PO, showing the same data as the PDF export
// (backend/services/lembarPOExportService.js) — order summary, Jahit/
// Finishing production notes, design photo, and the per-item size
// breakdown — without needing to open/download the PDF itself.
export function LembarPOPreviewDialog({
  orderId,
  open,
  onOpenChange,
}: {
  orderId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['lembar-po-by-order', orderId],
    queryFn: () => lembarPOApi.getLembarPOByOrder(orderId!),
    enabled: open && !!orderId,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lembar PO{data ? ` — ${data.order.invoice_no}` : ''}</DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
            <Loader2 className="size-4 animate-spin" /> Memuat Lembar PO...
          </div>
        )}

        {isError && (
          <div className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-center text-sm">
            <FileWarning className="size-6" />
            Lembar PO untuk order ini belum dibuat.
          </div>
        )}

        {data && (
          <div className="flex flex-col gap-4 text-sm">
            <div className="grid grid-cols-2 gap-3 rounded-lg border p-3">
              <div>
                <p className="text-muted-foreground text-xs">Nama Order</p>
                <p className="font-medium">{data.order.order_name}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Customer</p>
                <p className="font-medium">{data.order.customer_name || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">QTY</p>
                <p className="font-medium">{data.order.items.reduce((sum, i) => sum + i.qty, 0)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Deadline</p>
                <p className="font-medium">{data.order.deadline ? formatDate(data.order.deadline) : '-'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-semibold">Jahit</p>
                  <Badge variant={data.label ? 'default' : 'secondary'}>LABEL: {data.label ? 'YA' : 'TIDAK'}</Badge>
                </div>
                <p className="text-muted-foreground text-xs">Sablon / Bordir</p>
                <p className="mb-2">{data.sablon_bordir || '-'}</p>
                <p className="text-muted-foreground text-xs">Catatan</p>
                <p>{data.catatan || '-'}</p>
              </div>
              <div className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-semibold">Finishing</p>
                  <Badge variant={data.hangtag ? 'default' : 'secondary'}>
                    HANGTAG: {data.hangtag ? 'YA' : 'TIDAK'}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-xs">Bahan & Tipe</p>
                <p className="mb-2">{data.bahan_tipe || '-'}</p>
                <p className="text-muted-foreground text-xs">Pola Potong</p>
                <p>{data.pola_potong || '-'}</p>
              </div>
            </div>

            <div className="rounded-lg border border-dashed p-2">
              {data.order.desain_fix_url ? (
                <img
                  src={data.order.desain_fix_url}
                  alt="Desain"
                  className="mx-auto max-h-64 w-auto rounded object-contain"
                />
              ) : (
                <p className="text-muted-foreground py-8 text-center text-xs">Tidak ada gambar desain</p>
              )}
            </div>

            <div>
              <p className="mb-2 font-semibold">Ukuran per Tipe</p>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-2 text-left font-medium">Nama Item</th>
                      <th className="p-2 text-left font-medium">Ukuran</th>
                      <th className="p-2 text-right font-medium">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.order.items.length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-muted-foreground p-3 text-center">
                          Belum ada item.
                        </td>
                      </tr>
                    )}
                    {data.order.items.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="p-2 font-medium">{item.nama_item}</td>
                        <td className="p-2">
                          {item.sizes.length > 0
                            ? item.sizes.map((s) => `${s.size} (${s.qty})`).join(', ')
                            : '-'}
                        </td>
                        <td className="p-2 text-right">{item.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                  {data.order.items.length > 0 && (
                    <tfoot className="bg-muted/50 font-semibold">
                      <tr className="border-t">
                        <td className="p-2" colSpan={2}>
                          TOTAL
                        </td>
                        <td className="p-2 text-right">{data.order.items.reduce((sum, i) => sum + i.qty, 0)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
