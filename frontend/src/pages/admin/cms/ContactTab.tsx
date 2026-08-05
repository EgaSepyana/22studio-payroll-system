import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import * as cmsApi from '@/services/cmsApi'
import { getErrorMessage } from '@/services/api'
import type { CmsContactInfo, CmsFoundersPromise } from '@/types'

function ContactInfoForm() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['cms', 'contact-info'], queryFn: cmsApi.getContactInfo })
  const [values, setValues] = React.useState<CmsContactInfo | null>(null)

  React.useEffect(() => {
    if (data && !values) setValues(data)
  }, [data, values])

  const mutation = useMutation({
    mutationFn: (v: CmsContactInfo) => cmsApi.updateContactInfo(v),
    onSuccess: (saved) => {
      toast.success('Info kontak disimpan')
      setValues(saved)
      queryClient.invalidateQueries({ queryKey: ['cms', 'contact-info'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  if (isLoading || !values) {
    return (
      <CardContent className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
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
          <label className="text-sm font-medium">Alamat</label>
          <Textarea value={values.address} onChange={(e) => setValues({ ...values, address: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Telepon</label>
          <Input value={values.phone} onChange={(e) => setValues({ ...values, phone: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Email</label>
          <Input value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Jam Operasional</label>
          {values.hours.map((line, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder="Senin–Jumat: 09.00–18.00"
                value={line}
                onChange={(e) => {
                  const next = [...values.hours]
                  next[i] = e.target.value
                  setValues({ ...values, hours: next })
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setValues({ ...values, hours: values.hours.filter((_, idx) => idx !== i) })}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => setValues({ ...values, hours: [...values.hours, ''] })}
          >
            <Plus className="size-4" /> Tambah Baris
          </Button>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Google Maps Embed URL</label>
          <Textarea
            value={values.map_embed}
            onChange={(e) => setValues({ ...values, map_embed: e.target.value })}
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

function FoundersPromiseForm() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['cms', 'founders-promise'], queryFn: cmsApi.getFoundersPromise })
  const [values, setValues] = React.useState<CmsFoundersPromise | null>(null)

  React.useEffect(() => {
    if (data && !values) setValues(data)
  }, [data, values])

  const mutation = useMutation({
    mutationFn: (v: CmsFoundersPromise) => cmsApi.updateFoundersPromise(v),
    onSuccess: (saved) => {
      toast.success('Kutipan founder disimpan')
      setValues(saved)
      queryClient.invalidateQueries({ queryKey: ['cms', 'founders-promise'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  if (isLoading || !values) {
    return (
      <CardContent className="space-y-3">
        <Skeleton className="h-20 w-full" />
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
          <label className="text-sm font-medium">Kutipan</label>
          <Textarea
            rows={5}
            value={values.quote}
            onChange={(e) => setValues({ ...values, quote: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Nama</label>
          <Input value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Jabatan</label>
          <Input value={values.role} onChange={(e) => setValues({ ...values, role: e.target.value })} />
        </div>
        <Button type="submit" className="w-fit" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
          Simpan
        </Button>
      </form>
    </CardContent>
  )
}

export function ContactTab() {
  return (
    <div className="flex flex-col gap-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading text-base">Info Kontak</CardTitle>
        </CardHeader>
        <ContactInfoForm />
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading text-base">Kutipan Founder</CardTitle>
        </CardHeader>
        <FoundersPromiseForm />
      </Card>
    </div>
  )
}
