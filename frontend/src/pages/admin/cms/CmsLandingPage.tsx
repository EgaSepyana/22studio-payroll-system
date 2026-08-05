import { PageHeader } from '@/components/PageHeader'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { GeneralTab } from './GeneralTab'
import { HeroTab } from './HeroTab'
import { ContentTab } from './ContentTab'
import { ContactTab } from './ContactTab'

// 14 content.js sections grouped into 4 top-level tabs (vertical rail, since
// a flat 14-tab horizontal bar would overflow) — grouping follows the
// landing page's own top-to-bottom visual structure so an admin's mental
// model of "what I edit here is what I see there" holds.
export default function CmsLandingPage() {
  return (
    <div>
      <PageHeader
        title="Kelola Landing Page"
        description="Kelola konten yang ditampilkan di halaman utama 22studio.vercel.app"
        breadcrumbs={[{ label: 'Dashboard', to: '/admin' }, { label: 'Kelola Landing Page' }]}
      />

      <Tabs defaultValue="general" orientation="vertical" className="md:flex-row">
        <TabsList className="md:h-fit md:min-w-48">
          <TabsTrigger value="general">Umum</TabsTrigger>
          <TabsTrigger value="hero">Beranda</TabsTrigger>
          <TabsTrigger value="content">Konten</TabsTrigger>
          <TabsTrigger value="contact">Kontak</TabsTrigger>
        </TabsList>

        <TabsContent value="general"><GeneralTab /></TabsContent>
        <TabsContent value="hero"><HeroTab /></TabsContent>
        <TabsContent value="content"><ContentTab /></TabsContent>
        <TabsContent value="contact"><ContactTab /></TabsContent>
      </Tabs>
    </div>
  )
}
