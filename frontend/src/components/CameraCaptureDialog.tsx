import * as React from 'react'
import { Camera, Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// Real in-app camera viewfinder via getUserMedia — used instead of relying
// on <input capture> for the "Ambil Foto" action, since that attribute only
// triggers a native camera app on mobile browsers; on desktop (and some
// mobile browsers too) it silently falls back to the plain file picker,
// indistinguishable from "Galeri". This gives a live preview + shutter that
// works the same way on a desktop webcam or a phone camera.
export function CameraCaptureDialog({
  open,
  onOpenChange,
  onCapture,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCapture: (file: File) => void
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [starting, setStarting] = React.useState(false)
  const [capturing, setCapturing] = React.useState(false)

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  React.useEffect(() => {
    if (!open) {
      stopStream()
      return
    }

    let cancelled = false
    setError(null)
    setStarting(true)
    ;(async () => {
      try {
        // "environment" is a hint, not a hard requirement — a device with
        // no rear camera (most laptops) still gets its regular webcam.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch (err) {
        if (cancelled) return
        const message =
          err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
            ? 'Akses kamera ditolak. Izinkan akses kamera di browser untuk mengambil foto.'
            : 'Tidak dapat mengakses kamera perangkat ini.'
        setError(message)
      } finally {
        if (!cancelled) setStarting(false)
      }
    })()

    return () => {
      cancelled = true
      stopStream()
    }
  }, [open])

  function handleCapture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    setCapturing(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas tidak didukung')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          setCapturing(false)
          if (!blob) {
            toast.error('Gagal mengambil foto, coba lagi')
            return
          }
          const file = new File([blob], `laporan-pengerjaan-${Date.now()}.jpg`, { type: 'image/jpeg' })
          onCapture(file)
          onOpenChange(false)
        },
        'image/jpeg',
        0.9
      )
    } catch {
      setCapturing(false)
      toast.error('Gagal mengambil foto, coba lagi')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ambil Foto</DialogTitle>
        </DialogHeader>
        <div className="bg-muted relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-md">
          {error ? (
            <p className="text-destructive px-4 text-center text-sm">{error}</p>
          ) : (
            <>
              {starting && <Loader2 className="text-muted-foreground absolute size-6 animate-spin" />}
              {/* muted+playsInline required for autoplay on iOS Safari */}
              <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
            </>
          )}
        </div>
        <DialogFooter>
          {error ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setError(null)
                setStarting(true)
                onOpenChange(false)
                setTimeout(() => onOpenChange(true), 0)
              }}
            >
              <RotateCcw className="size-4" /> Coba Lagi
            </Button>
          ) : (
            <Button type="button" onClick={handleCapture} disabled={starting || capturing}>
              {capturing ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              Ambil Foto
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
