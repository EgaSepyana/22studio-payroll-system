import * as React from 'react'
import { Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getErrorMessage } from '@/services/api'
import { cn } from '@/lib/utils'

// Extracted from the inline upload block on the Order form (design-image
// field) and generalized: any upload function can be injected, and — unlike
// the order form, which only ever uploads — a plain URL can also be pasted
// directly, since some CMS content (client logos) legitimately lives at an
// external URL rather than something we've uploaded ourselves.
export function ImageUploadField({
  value,
  onChange,
  upload,
  aspectRatio = 'aspect-video',
  className,
}: {
  value: string
  onChange: (url: string) => void
  upload: (file: File) => Promise<string>
  aspectRatio?: string
  className?: string
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        className={cn(
          'bg-muted flex w-full items-center justify-center overflow-hidden rounded-md border',
          aspectRatio
        )}
      >
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-muted-foreground text-xs">Belum ada gambar</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            setUploading(true)
            try {
              const url = await upload(file)
              onChange(url)
            } catch (err) {
              toast.error(getErrorMessage(err))
            } finally {
              setUploading(false)
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {value ? 'Ganti Gambar' : 'Upload Gambar'}
        </Button>
        {value && (
          <button
            type="button"
            className="text-destructive text-xs hover:underline"
            onClick={() => onChange('')}
          >
            Hapus
          </button>
        )}
      </div>

      <Input
        placeholder="atau tempel URL gambar"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
