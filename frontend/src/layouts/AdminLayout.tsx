import * as React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Building2,
  Package,
  ClipboardList,
  Wallet,
  FileBarChart,
  HandCoins,
  LogOut,
  Menu,
  KeyRound,
  Clock,
  ListTodo,
  Truck,
  ShoppingCart,
  CalendarDays,
  FileText,
  Settings,
  Tags,
  Globe,
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

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Utama',
    items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'Master Data',
    items: [
      { to: '/admin/employees', label: 'Karyawan', icon: Users },
      { to: '/admin/customers', label: 'Customer', icon: Building2 },
      { to: '/admin/articles', label: 'Artikel', icon: Package },
      { to: '/admin/article-categories', label: 'Kategori Artikel', icon: Tags },
    ],
  },
  {
    label: 'Produksi',
    items: [
      { to: '/admin/order', label: 'Order', icon: ShoppingCart },
      { to: '/admin/orders', label: 'Task', icon: ListTodo },
      { to: '/admin/surat-jalan', label: 'Surat Jalan', icon: Truck },
      { to: '/admin/kalender-produksi', label: 'Kalender Produksi', icon: CalendarDays },
      { to: '/admin/lembar-po', label: 'Lembar PO', icon: FileText },
    ],
  },
  {
    label: 'Penggajian',
    items: [
      { to: '/admin/worklogs', label: 'Data Pekerjaan', icon: ClipboardList },
      { to: '/admin/payroll', label: 'Payroll', icon: Wallet },
      { to: '/admin/kasbon', label: 'Kasbon', icon: HandCoins },
      { to: '/admin/attendance', label: 'Absensi', icon: Clock },
    ],
  },
  {
    label: 'Report',
    items: [{ to: '/admin/reports', label: 'Laporan', icon: FileBarChart }],
  },
  {
    label: 'Pengaturan',
    items: [
      { to: '/admin/pengaturan-aplikasi', label: 'Pengaturan Aplikasi', icon: Settings },
      { to: '/admin/cms', label: 'Kelola Landing Page', icon: Globe },
    ],
  },
]

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth()
  // admin_produksi only ever sees the Produksi group — every other group
  // (Master Data, Penggajian, Report, Pengaturan) is admin-only.
  const groups = user?.role === 'admin_produksi' ? NAV_GROUPS.filter((g) => g.label === 'Produksi') : NAV_GROUPS

  return (
    <nav className="flex flex-col gap-4 px-3">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="text-sidebar-foreground/50 px-3 text-xs font-semibold tracking-wide uppercase">
            {group.label}
          </p>
          {group.items.map((item) => (
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
        </div>
      ))}
    </nav>
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
            <p className="text-muted-foreground text-xs font-normal">
              {user?.role === 'admin_produksi' ? 'Admin Produksi' : 'Administrator'}
            </p>
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

export default function AdminLayout() {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)

  return (
    <div className="bg-background flex min-h-dvh">
      <aside className="border-sidebar-border bg-sidebar sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r lg:flex">
        <div className="flex h-16 items-center gap-2 px-5">
          <img src="/logo.svg" alt="22Studio" className="size-8 shrink-0 rounded-md object-cover" />
          <span className="font-heading text-sidebar-foreground text-base font-semibold">
            22Studio Sablon & Konveksi Apps
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
                <span className="font-heading text-base font-semibold">22Studio Payroll</span>
              </div>
              <div className="flex-1 overflow-y-auto py-2">
                <NavList onNavigate={() => setMobileNavOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex-1" />
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
