import * as React from 'react'
import { Camera, ImageIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CameraCaptureDialog } from '@/components/CameraCaptureDialog'
import { getErrorMessage } from '@/services/api'

// Photo evidence field for Cutting work logs and Finishing progress updates.
// "Ambil Foto" opens a real in-app camera viewfinder (CameraCaptureDialog,
// via getUserMedia) instead of relying on <input capture> — that attribute
// only triggers a native camera app on some mobile browsers and silently
// falls back to the plain file picker everywhere else (including desktop),
// making it indistinguishable from "Galeri". A live preview + shutter works
// the same way on a desktop webcam or a phone camera. "Galeri" stays a plain
// file input for picking an existing photo from local storage.
export function WorkPhotoCaptureField({
  value,
  onChange,
  upload,
}: {
  value: string
  onChange: (url: string) => void
  upload: (file: File) => Promise<string>
}) {
  const galleryInputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [cameraOpen, setCameraOpen] = React.useState(false)

  async function handleFile(file: File | undefined) {
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
  }

  return (
    <div className="flex items-center gap-3">
      {value && (
        <img
          src={value}
          alt="Laporan Pengerjaan"
          className="border-border h-16 w-16 shrink-0 rounded-md border object-cover"
        />
      )}
      <div className="flex flex-col gap-1">
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            handleFile(file)
          }}
        />
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => setCameraOpen(true)}
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            Ambil Foto
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => galleryInputRef.current?.click()}
          >
            <ImageIcon className="size-4" />
            Galeri
          </Button>
        </div>
        {value && (
          <button
            type="button"
            className="text-destructive w-fit text-xs hover:underline"
            onClick={() => onChange('')}
          >
            Hapus foto
          </button>
        )}
      </div>
      <CameraCaptureDialog open={cameraOpen} onOpenChange={setCameraOpen} onCapture={handleFile} />
    </div>
  )
}
