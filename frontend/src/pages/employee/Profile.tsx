import * as React from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { KeyRound, Loader2, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog'
import { useAuth } from '@/hooks/useAuth'
import * as profileApi from '@/services/profileApi'
import { getErrorMessage } from '@/services/api'
import { useNavigate } from 'react-router-dom'

const schema = z.object({ phone: z.string().min(1, 'Nomor HP wajib diisi') })
type FormValues = z.infer<typeof schema>

export default function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [changePasswordOpen, setChangePasswordOpen] = React.useState(false)

  const { data, isLoading } = useQuery({ queryKey: ['profile'], queryFn: profileApi.getProfile })

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phone: '' },
    values: data ? { phone: data.phone || '' } : undefined,
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) => profileApi.updateProfile(values.phone),
    onSuccess: () => {
      toast.success('Profil berhasil diperbarui')
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <Avatar className="size-16">
          <AvatarFallback className="bg-primary text-primary-foreground text-lg">
            {user?.name?.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-lg font-semibold">{user?.name}</p>
          <p className="text-muted-foreground text-sm">@{user?.username}</p>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Edit Nomor HP</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Form {...form}>
              <form
                className="flex flex-col gap-4"
                onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
              >
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nomor HP</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="08xxxxxxxxxx" className="h-12" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="h-12" disabled={mutation.isPending}>
                  {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
                  Simpan Perubahan
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      <Button variant="outline" className="h-12" onClick={() => setChangePasswordOpen(true)}>
        <KeyRound className="size-4" /> Ganti Password
      </Button>

      <Button
        variant="ghost"
        className="text-destructive hover:text-destructive h-12"
        onClick={() => {
          logout()
          navigate('/login')
        }}
      >
        <LogOut className="size-4" /> Logout
      </Button>

      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </div>
  )
}
