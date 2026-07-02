import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { LogIn, LogOut, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import * as attendanceApi from '@/services/attendanceApi'
import { getErrorMessage } from '@/services/api'
import { formatDate, formatTime } from '@/utils/format'

export default function Absensi() {
  const queryClient = useQueryClient()

  const { data: today, isLoading: todayLoading } = useQuery({
    queryKey: ['attendance-today'],
    queryFn: attendanceApi.getTodayAttendance,
  })

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['attendance-mine'],
    queryFn: () => attendanceApi.listMyAttendance(),
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['attendance-today'] })
    queryClient.invalidateQueries({ queryKey: ['attendance-mine'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'employee'] })
  }

  const checkInMutation = useMutation({
    mutationFn: attendanceApi.checkIn,
    onSuccess: () => {
      toast.success('Check-in berhasil')
      invalidate()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const checkOutMutation = useMutation({
    mutationFn: attendanceApi.checkOut,
    onSuccess: () => {
      toast.success('Check-out berhasil')
      invalidate()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const hasCheckedIn = !!today?.check_in
  const hasCheckedOut = !!today?.check_out

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-semibold">Absensi</h1>
        <p className="text-muted-foreground text-sm">Catat kehadiranmu hari ini.</p>
      </div>

      <Tabs defaultValue="absen">
        <TabsList className="w-full">
          <TabsTrigger value="absen" className="flex-1">Absen</TabsTrigger>
          <TabsTrigger value="riwayat" className="flex-1">Riwayat</TabsTrigger>
        </TabsList>

        <TabsContent value="absen" className="mt-4">
          <Card className="shadow-sm">
            <CardContent className="flex flex-col items-center gap-5 py-8">
              {todayLoading ? (
                <Skeleton className="h-32 w-full rounded-xl" />
              ) : (
                <>
                  <div className="flex w-full flex-col gap-2 text-center">
                    <p className="text-muted-foreground text-sm">{formatDate(new Date().toISOString())}</p>
                    <div className="flex justify-center gap-8">
                      <div>
                        <p className="text-muted-foreground text-xs">Check-in</p>
                        <p className="text-lg font-semibold">
                          {hasCheckedIn ? formatTime(today!.check_in) : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Check-out</p>
                        <p className="text-lg font-semibold">
                          {hasCheckedOut ? formatTime(today!.check_out) : '-'}
                        </p>
                      </div>
                    </div>
                    {hasCheckedOut && (
                      <p className="text-success text-sm font-medium">
                        Selesai — {today?.hours ?? 0} jam kerja tercatat hari ini
                      </p>
                    )}
                  </div>

                  {!hasCheckedIn && (
                    <Button
                      size="lg"
                      className="h-16 w-full text-base"
                      disabled={checkInMutation.isPending}
                      onClick={() => checkInMutation.mutate()}
                    >
                      {checkInMutation.isPending ? (
                        <Loader2 className="size-5 animate-spin" />
                      ) : (
                        <LogIn className="size-5" />
                      )}
                      Check-in
                    </Button>
                  )}
                  {hasCheckedIn && !hasCheckedOut && (
                    <Button
                      size="lg"
                      variant="secondary"
                      className="h-16 w-full text-base"
                      disabled={checkOutMutation.isPending}
                      onClick={() => checkOutMutation.mutate()}
                    >
                      {checkOutMutation.isPending ? (
                        <Loader2 className="size-5 animate-spin" />
                      ) : (
                        <LogOut className="size-5" />
                      )}
                      Check-out
                    </Button>
                  )}
                  {hasCheckedOut && (
                    <p className="text-muted-foreground text-sm">Kamu sudah absen lengkap hari ini.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="riwayat" className="mt-4 flex flex-col gap-3">
          {historyLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : history?.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">Belum ada riwayat absensi.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {history?.map((row) => (
                <Card key={row.id} className="shadow-sm">
                  <CardContent className="flex items-center justify-between gap-3 py-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{formatDate(row.date)}</p>
                      <p className="text-muted-foreground text-xs">
                        {row.check_in ? formatTime(row.check_in) : '-'} — {row.check_out ? formatTime(row.check_out) : '-'}
                      </p>
                    </div>
                    <p className="text-lg font-semibold">{row.hours ?? '-'} jam</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
