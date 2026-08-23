import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { RequireAuth, homeRouteForRole } from '@/components/RequireAuth'
import AdminLayout from '@/layouts/AdminLayout'
import OwnerLayout from '@/layouts/OwnerLayout'
import EmployeeLayout from '@/layouts/EmployeeLayout'
import Login from '@/pages/auth/Login'

import AdminDashboard from '@/pages/admin/Dashboard'
import AdminEmployees from '@/pages/admin/Employees'
import AdminCustomers from '@/pages/admin/Customers'
import AdminArticles from '@/pages/admin/Articles'
import AdminArticleCategories from '@/pages/admin/ArticleCategories'
import AdminWorkLogs from '@/pages/admin/WorkLogs'
import AdminPayroll from '@/pages/admin/Payroll'
import AdminReports from '@/pages/admin/Reports'
import AdminKasbon from '@/pages/admin/Kasbon'
import AdminAttendance from '@/pages/admin/Attendance'
import AdminOrders from '@/pages/admin/Orders'
import AdminTaskDetail from '@/pages/admin/TaskDetail'
import AdminOrder from '@/pages/admin/Order'
import AdminOrderDetail from '@/pages/admin/OrderDetail'
import AdminSuratJalan from '@/pages/admin/SuratJalan'
import AdminSuratJalanDetail from '@/pages/admin/SuratJalanDetail'
import AdminKalenderProduksi from '@/pages/admin/KalenderProduksi'
import AdminLembarPO from '@/pages/admin/LembarPO'
import AdminPengaturanAplikasi from '@/pages/admin/PengaturanAplikasi'
import AdminCmsLandingPage from '@/pages/admin/cms/CmsLandingPage'

import OwnerDashboard from '@/pages/owner/Dashboard'
import OwnerSettings from '@/pages/owner/Settings'
import OwnerCash from '@/pages/owner/Cash'
import OwnerIncome from '@/pages/owner/Income'
import OwnerExpenses from '@/pages/owner/Expenses'
import OwnerLiabilities from '@/pages/owner/Liabilities'
import OwnerAssets from '@/pages/owner/Assets'
import OwnerInventory from '@/pages/owner/Inventory'
import OwnerProfitLoss from '@/pages/owner/ProfitLoss'
import OwnerBalanceSheet from '@/pages/owner/BalanceSheet'

import EmployeeDashboard from '@/pages/employee/Dashboard'
import EmployeeInput from '@/pages/employee/InputPekerjaan'
import EmployeeRiwayatPekerjaan from '@/pages/employee/RiwayatPekerjaan'
import EmployeeRiwayatGaji from '@/pages/employee/RiwayatGaji'
import EmployeeKasbon from '@/pages/employee/Kasbon'
import EmployeeProfile from '@/pages/employee/Profile'
import EmployeeAbsensi from '@/pages/employee/Absensi'
import EmployeeTasks from '@/pages/employee/Tasks'
import EmployeeSuratJalan from '@/pages/employee/SuratJalan'
import EmployeeSuratJalanDetail from '@/pages/employee/SuratJalanDetail'

function HomeRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={homeRouteForRole(user.role)} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<Login />} />

        <Route element={<RequireAuth allow={['admin', 'admin_produksi', 'owner']} />}>
          <Route element={<AdminLayout />}>
            {/* Produksi routes: admin, admin_produksi, and owner can all reach these. */}
            <Route path="/admin/orders" element={<AdminOrders />} />
            <Route path="/admin/orders/:id" element={<AdminTaskDetail />} />
            <Route path="/admin/order" element={<AdminOrder />} />
            <Route path="/admin/order/:id" element={<AdminOrderDetail />} />
            <Route path="/admin/surat-jalan" element={<AdminSuratJalan />} />
            <Route path="/admin/surat-jalan/:id" element={<AdminSuratJalanDetail />} />
            <Route path="/admin/kalender-produksi" element={<AdminKalenderProduksi />} />
            <Route path="/admin/lembar-po" element={<AdminLembarPO />} />

            {/* Everything else: admin + owner (owner is a superset of admin) —
                admin_produksi lands here via RequireAuth's mismatch redirect
                if it tries to navigate in directly (e.g. typing
                /admin/payroll in the address bar). */}
            <Route element={<RequireAuth allow={['admin', 'owner']} />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/employees" element={<AdminEmployees />} />
              <Route path="/admin/customers" element={<AdminCustomers />} />
              <Route path="/admin/articles" element={<AdminArticles />} />
              <Route path="/admin/article-categories" element={<AdminArticleCategories />} />
              <Route path="/admin/worklogs" element={<AdminWorkLogs />} />
              <Route path="/admin/payroll" element={<AdminPayroll />} />
              <Route path="/admin/reports" element={<AdminReports />} />
              <Route path="/admin/kasbon" element={<AdminKasbon />} />
              <Route path="/admin/attendance" element={<AdminAttendance />} />
              <Route path="/admin/pengaturan-aplikasi" element={<AdminPengaturanAplikasi />} />
              <Route path="/admin/cms" element={<AdminCmsLandingPage />} />
            </Route>
          </Route>
        </Route>

        {/* Keuangan (Finance): owner's own app, separate from AdminLayout —
            owner still reaches /admin via the RequireAuth block above (its
            own layout/nav) for operational access; each links to the other. */}
        <Route element={<RequireAuth allow="owner" />}>
          <Route element={<OwnerLayout />}>
            <Route path="/owner" element={<OwnerDashboard />} />
            <Route path="/owner/kas" element={<OwnerCash />} />
            <Route path="/owner/pemasukan" element={<OwnerIncome />} />
            <Route path="/owner/pengeluaran" element={<OwnerExpenses />} />
            <Route path="/owner/kewajiban" element={<OwnerLiabilities />} />
            <Route path="/owner/aset" element={<OwnerAssets />} />
            <Route path="/owner/stok" element={<OwnerInventory />} />
            <Route path="/owner/laba-rugi" element={<OwnerProfitLoss />} />
            <Route path="/owner/neraca" element={<OwnerBalanceSheet />} />
            <Route path="/owner/pengaturan" element={<OwnerSettings />} />
          </Route>
        </Route>

        <Route element={<RequireAuth allow="employee" />}>
          <Route element={<EmployeeLayout />}>
            <Route path="/app" element={<EmployeeDashboard />} />
            <Route path="/app/input" element={<EmployeeInput />} />
            <Route path="/app/riwayat-pekerjaan" element={<EmployeeRiwayatPekerjaan />} />
            <Route path="/app/riwayat-gaji" element={<EmployeeRiwayatGaji />} />
            <Route path="/app/kasbon" element={<EmployeeKasbon />} />
            <Route path="/app/profile" element={<EmployeeProfile />} />
            <Route path="/app/absensi" element={<EmployeeAbsensi />} />
            <Route path="/app/tasks" element={<EmployeeTasks />} />
            <Route path="/app/surat-jalan" element={<EmployeeSuratJalan />} />
            <Route path="/app/surat-jalan/:id" element={<EmployeeSuratJalanDetail />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
