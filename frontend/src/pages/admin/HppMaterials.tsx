import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/PageHeader'
import { HppDatabase } from './hpp/HppDatabase'
import * as hppApi from '@/services/hppApi'

export default function HppMaterialsPage() {
  const { data: fabrics = [] } = useQuery({ queryKey: ['hpp-fabrics'], queryFn: hppApi.listFabrics })
  const { data: threads = [] } = useQuery({ queryKey: ['hpp-threads'], queryFn: hppApi.listThreads })

  return (
    <div>
      <PageHeader
        title="Database Bahan & Benang"
        description="Daftar bahan kain dan kode warna benang yang dipakai Kalkulator HPP."
        breadcrumbs={[{ label: 'Dashboard', to: '/admin' }, { label: 'Database Bahan & Benang' }]}
      />
      <HppDatabase fabrics={fabrics} threads={threads} />
    </div>
  )
}
