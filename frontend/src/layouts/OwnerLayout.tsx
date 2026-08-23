import * as React from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Settings,
  LogOut,
  Menu,
  KeyRound,
  ShieldCheck,
  Wallet,
  TrendingUp,
  TrendingDown,
  HandCoins,
  Package,
  Boxes,
  FileBarChart,
  Scale,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

// Every financial module from owner.md is now built.
const NAV_ITEMS: NavItem[] = [
  { to: '/owner', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/owner/kas', label: 'Mutasi & Penyesuaian Kas', icon: Wallet },
  { to: '/owner/pemasukan', label: 'Pemasukan', icon: TrendingUp },
  { to: '/owner/pengeluaran', label: 'Pengeluaran', icon: TrendingDown },
  { to: '/owner/kewajiban', label: 'Kewajiban', icon: HandCoins },
  { to: '/owner/aset', label: 'Aset', icon: Package },
  { to: '/owner/stok', label: 'Stok Persediaan', icon: Boxes },
  { to: '/owner/laba-rugi', label: 'Laba Rugi', icon: FileBarChart },
  { to: '/owner/neraca', label: 'Neraca', icon: Scale },
  { to: '/owner/pengaturan', label: 'Pengaturan Keuangan', icon: Settings },
]

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 px-3">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )
          }
        >
          <item.icon className="size-4.5 shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

// Owner's Keuangan shell is its own "app" separate from operational
// AdminLayout — this is the way in, symmetric to AdminLayout's own
// owner-only return link back to /owner.
function AdminAccessLink() {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link to="/admin">
        <ShieldCheck className="size-4" /> <span className="hidden sm:inline">Buka Admin</span>
      </Link>
    </Button>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [changePasswordOpen, setChangePasswordOpen] = React.useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 px-2">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {user?.name?.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium sm:inline">{user?.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <p className="font-medium">{user?.name}</p>
            <p className="text-muted-foreground text-xs font-normal">Owner</p>
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
      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </>
  )
}

export default function OwnerLayout() {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)

  return (
    <div className="bg-background flex min-h-dvh">
      <aside className="border-sidebar-border bg-sidebar sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r lg:flex">
        <div className="flex h-16 items-center gap-2 px-5">
          <img src="/logo.svg" alt="22Studio" className="size-8 shrink-0 rounded-md object-cover" />
          <span className="font-heading text-sidebar-foreground text-base font-semibold">
            22Studio Keuangan
          </span>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <NavList />
        </div>
      </aside>

      <div className="flex min-h-dvh flex-1 flex-col">
        <header className="bg-background/95 sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b px-4 backdrop-blur supports-backdrop-filter:bg-background/80 lg:px-8">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 gap-0 p-0">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="flex h-16 shrink-0 items-center gap-2 px-5">
                <img src="/logo.svg" alt="22Studio" className="size-8 shrink-0 rounded-md object-cover" />
                <span className="font-heading text-base font-semibold">22Studio Keuangan</span>
              </div>
              <div className="flex-1 overflow-y-auto py-2">
                <NavList onNavigate={() => setMobileNavOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex-1" />
          <AdminAccessLink />
          <UserMenu />
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
