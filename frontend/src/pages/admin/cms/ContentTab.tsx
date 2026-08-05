import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { SortableListEditor, type CmsFieldConfig } from '@/components/cms/SortableListEditor'
import type { CmsService, CmsProject, CmsStep, CmsStatsBandItem, CmsFaq, CmsClient } from '@/types'

const ICON_OPTIONS = [
  { value: 'shirt', label: 'Shirt' },
  { value: 'spray-can', label: 'Spray Can' },
  { value: 'scissors', label: 'Scissors' },
  { value: 'palette', label: 'Palette' },
  { value: 'package', label: 'Package' },
]

const CSS_VAR_OPTIONS = [
  { value: '--primary', label: 'Primary' },
  { value: '--accent', label: 'Accent' },
  { value: '--secondary', label: 'Secondary' },
  { value: '--accent-2', label: 'Accent 2' },
]

const serviceFields: CmsFieldConfig<CmsService>[] = [
  { key: 'title', label: 'Judul', type: 'text', placeholder: 'Screen Printing' },
  { key: 'icon', label: 'Ikon', type: 'select', options: ICON_OPTIONS },
  { key: 'css_var', label: 'Warna', type: 'select', options: CSS_VAR_OPTIONS },
  { key: 'description', label: 'Deskripsi', type: 'textarea' },
  { key: 'points', label: 'Poin Unggulan (3)', type: 'points' },
]

const projectFields: CmsFieldConfig<CmsProject>[] = [
  { key: 'title', label: 'Judul', type: 'text', placeholder: 'Merchandise Band Musik' },
  { key: 'image_url', label: 'Gambar', type: 'image' },
  { key: 'description', label: 'Deskripsi', type: 'textarea' },
]

const stepFields: CmsFieldConfig<CmsStep>[] = [
  { key: 'stage', label: 'Nomor Tahap', type: 'text', placeholder: '01' },
  { key: 'title', label: 'Judul', type: 'text', placeholder: 'Konsultasi' },
  { key: 'description', label: 'Deskripsi', type: 'textarea' },
]

const statsBandFields: CmsFieldConfig<CmsStatsBandItem>[] = [
  { key: 'label', label: 'Label', type: 'text', placeholder: 'Tahun Berdiri' },
  { key: 'value', label: 'Nilai', type: 'text', placeholder: '2015' },
  { key: 'prefix', label: 'Prefix (opsional)', type: 'text' },
  { key: 'suffix', label: 'Suffix (opsional)', type: 'text', placeholder: '%' },
]

const faqFields: CmsFieldConfig<CmsFaq>[] = [
  { key: 'question', label: 'Pertanyaan', type: 'text' },
  { key: 'answer', label: 'Jawaban', type: 'textarea' },
]

const clientFields: CmsFieldConfig<CmsClient>[] = [
  { key: 'name', label: 'Nama', type: 'text', placeholder: 'Nike' },
  { key: 'logo_url', label: 'Logo', type: 'image' },
]

export function ContentTab() {
  return (
    <Tabs defaultValue="services">
      <TabsList>
        <TabsTrigger value="services">Layanan</TabsTrigger>
        <TabsTrigger value="projects">Projek</TabsTrigger>
        <TabsTrigger value="steps">Cara Order</TabsTrigger>
        <TabsTrigger value="stats-band">Statistik</TabsTrigger>
        <TabsTrigger value="faqs">FAQ</TabsTrigger>
        <TabsTrigger value="clients">Klien</TabsTrigger>
      </TabsList>

      <TabsContent value="services" className="mt-4">
        <SortableListEditor<CmsService>
          section="services"
          title="Layanan"
          emptyLabel="Belum ada layanan. Tambah yang pertama!"
          addLabel="Tambah Layanan"
          fields={serviceFields}
          primaryField="title"
        />
      </TabsContent>
      <TabsContent value="projects" className="mt-4">
        <SortableListEditor<CmsProject>
          section="projects"
          title="Projek"
          emptyLabel="Belum ada projek. Tambah yang pertama!"
          addLabel="Tambah Projek"
          fields={projectFields}
          primaryField="title"
        />
      </TabsContent>
      <TabsContent value="steps" className="mt-4">
        <SortableListEditor<CmsStep>
          section="steps"
          title="Cara Order"
          emptyLabel="Belum ada tahap. Tambah yang pertama!"
          addLabel="Tambah Tahap"
          fields={stepFields}
          primaryField="title"
        />
      </TabsContent>
      <TabsContent value="stats-band" className="mt-4">
        <SortableListEditor<CmsStatsBandItem>
          section="stats-band"
          title="Statistik Band"
          emptyLabel="Belum ada statistik. Tambah yang pertama!"
          addLabel="Tambah Statistik"
          fields={statsBandFields}
          primaryField="label"
        />
      </TabsContent>
      <TabsContent value="faqs" className="mt-4">
        <SortableListEditor<CmsFaq>
          section="faqs"
          title="FAQ"
          emptyLabel="Belum ada FAQ. Tambah yang pertama!"
          addLabel="Tambah FAQ"
          fields={faqFields}
          primaryField="question"
        />
      </TabsContent>
      <TabsContent value="clients" className="mt-4">
        <SortableListEditor<CmsClient>
          section="clients"
          title="Klien"
          emptyLabel="Belum ada klien. Tambah yang pertama!"
          addLabel="Tambah Klien"
          fields={clientFields}
          primaryField="name"
        />
      </TabsContent>
    </Tabs>
  )
}
