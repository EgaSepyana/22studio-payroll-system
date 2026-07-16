import * as React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, History, Wallet, HandCoins, User, LogOut, KeyRound, Clock, ListTodo, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog'

const PIECE_RATE_NAV_ITEMS = [
  { to: '/app', label: 'Beranda', icon: LayoutDashboard, end: true },
  { to: '/app/tasks', label: 'Tugas', icon: ListTodo },
  { to: '/app/input', label: 'Input', icon: PlusCircle },
  { to: '/app/riwayat-pekerjaan', label: 'Riwayat', icon: History },
  { to: '/app/riwayat-gaji', label: 'Gaji', icon: Wallet },
  { to: '/app/kasbon', label: 'Kasbon', icon: HandCoins },
  { to: '/app/profile', label: 'Profil', icon: User },
]

const FINISHING_NAV_ITEMS = [
  { to: '/app', label: 'Beranda', icon: LayoutDashboard, end: true },
  { to: '/app/absensi', label: 'Absensi', icon: Clock },
  { to: '/app/tasks', label: 'Tugas', icon: ListTodo },
  { to: '/app/surat-jalan', label: 'Surat Jalan', icon: Truck },
  { to: '/app/riwayat-gaji', label: 'Gaji', icon: Wallet },
  { to: '/app/kasbon', label: 'Kasbon', icon: HandCoins },
  { to: '/app/profile', label: 'Profil', icon: User },
]

export default function EmployeeLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [changePasswordOpen, setChangePasswordOpen] = React.useState(false)
  const NAV_ITEMS = user?.divisi === 'Finishing' ? FINISHING_NAV_ITEMS : PIECE_RATE_NAV_ITEMS

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="bg-background/95 sticky top-0 z-20 flex h-14 items-center justify-between border-b px-4 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="22Studio" className="size-7 shrink-0 rounded-md object-cover" />
          <span className="font-heading text-sm font-semibold">22Studio</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {user?.name?.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="font-medium">{user?.name}</p>
              <p className="text-muted-foreground text-xs font-normal">Karyawan</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
              <KeyRound className="size-4" /> Ganti Password
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                logout()
                navigate('/login')
              }}
            >
              <LogOut className="size-4" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-5 pb-24">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex max-w-lg items-stretch justify-between px-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )
              }
            >
              <item.icon className="size-5.5" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </div>
  )
}
