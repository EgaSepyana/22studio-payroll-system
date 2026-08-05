import { SortableListEditor, type CmsFieldConfig } from '@/components/cms/SortableListEditor'
import type { CmsHeroStat, CmsHeroSlide, CmsInkSwatch } from '@/types'

const CSS_VAR_OPTIONS = [
  { value: '--primary', label: 'Primary' },
  { value: '--accent', label: 'Accent' },
  { value: '--secondary', label: 'Secondary' },
  { value: '--accent-2', label: 'Accent 2' },
  { value: '--ink', label: 'Ink' },
]

const heroStatFields: CmsFieldConfig<CmsHeroStat>[] = [
  { key: 'label', label: 'Label', type: 'text', placeholder: 'Berdiri Sejak' },
  { key: 'value', label: 'Nilai', type: 'text', placeholder: '2015' },
]

const heroSlideFields: CmsFieldConfig<CmsHeroSlide>[] = [
  { key: 'image_url', label: 'Gambar', type: 'image' },
  { key: 'alt', label: 'Teks Alt', type: 'text', placeholder: 'Deskripsi gambar untuk aksesibilitas' },
]

const inkSwatchFields: CmsFieldConfig<CmsInkSwatch>[] = [
  { key: 'code', label: 'Kode', type: 'text', placeholder: 'INK.01' },
  { key: 'name', label: 'Nama Warna', type: 'text', placeholder: 'Biru Logo' },
  { key: 'css_var', label: 'CSS Variable', type: 'select', options: CSS_VAR_OPTIONS },
]

export function HeroTab() {
  return (
    <div className="flex flex-col gap-6">
      <SortableListEditor<CmsHeroStat>
        section="hero-stats"
        title="Statistik Hero"
        emptyLabel="Belum ada statistik. Tambah yang pertama!"
        addLabel="Tambah Statistik"
        fields={heroStatFields}
        primaryField="label"
      />
      <SortableListEditor<CmsHeroSlide>
        section="hero-slides"
        title="Slide Hero"
        emptyLabel="Belum ada slide. Tambah yang pertama!"
        addLabel="Tambah Slide"
        fields={heroSlideFields}
        primaryField="alt"
      />
      <SortableListEditor<CmsInkSwatch>
        section="ink-swatches"
        title="Ink Swatches"
        emptyLabel="Belum ada ink swatch. Tambah yang pertama!"
        addLabel="Tambah Swatch"
        fields={inkSwatchFields}
        primaryField="name"
      />
    </div>
  )
}
