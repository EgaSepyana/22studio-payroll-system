import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { SortableListEditor, type CmsFieldConfig } from '@/components/cms/SortableListEditor'
import * as cmsApi from '@/services/cmsApi'
import { getErrorMessage } from '@/services/api'
import type { CmsGeneralSettings, CmsNavLink } from '@/types'

const navLinkFields: CmsFieldConfig<CmsNavLink>[] = [
  { key: 'label', label: 'Label', type: 'text', placeholder: 'Tentang' },
  { key: 'href', label: 'Link (anchor/URL)', type: 'text', placeholder: '#about' },
]

function GeneralSettingsForm() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['cms', 'general'], queryFn: cmsApi.getGeneralSettings })
  const [values, setValues] = React.useState<CmsGeneralSettings | null>(null)

  React.useEffect(() => {
    if (data && !values) setValues(data)
  }, [data, values])

  const mutation = useMutation({
    mutationFn: (v: CmsGeneralSettings) => cmsApi.updateGeneralSettings(v),
    onSuccess: (saved) => {
      toast.success('Pengaturan umum disimpan')
      setValues(saved)
      queryClient.invalidateQueries({ queryKey: ['cms', 'general'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  if (isLoading || !values) {
    return (
      <CardContent className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </CardContent>
    )
  }

  return (
    <CardContent>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          mutation.mutate(values)
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Nomor WhatsApp</label>
          <Input
            placeholder="6281312322833"
            value={values.wa_phone}
            onChange={(e) => setValues({ ...values, wa_phone: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Pesan Default WhatsApp</label>
          <Input
            placeholder="sablon konveksi bandung?"
            value={values.wa_default_message}
            onChange={(e) => setValues({ ...values, wa_default_message: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Form Endpoint (Google Apps Script URL)</label>
          <Input
            placeholder="https://script.google.com/macros/s/..."
            value={values.form_endpoint}
            onChange={(e) => setValues({ ...values, form_endpoint: e.target.value })}
          />
        </div>
        <Button type="submit" className="w-fit" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
          Simpan
        </Button>
      </form>
    </CardContent>
  )
}

export function GeneralTab() {
  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading text-base">Umum</CardTitle>
        </CardHeader>
        <GeneralSettingsForm />
      </Card>

      <SortableListEditor<CmsNavLink>
        section="nav-links"
        title="Menu Navigasi"
        emptyLabel="Belum ada menu navigasi. Tambah yang pertama!"
        addLabel="Tambah Menu"
        fields={navLinkFields}
        primaryField="label"
      />
    </div>
  )
}
