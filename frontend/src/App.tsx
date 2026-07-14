import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { RequireAuth } from '@/components/RequireAuth'
import AdminLayout from '@/layouts/AdminLayout'
import EmployeeLayout from '@/layouts/EmployeeLayout'
import Login from '@/pages/auth/Login'

import AdminDashboard from '@/pages/admin/Dashboard'
import AdminEmployees from '@/pages/admin/Employees'
import AdminCustomers from '@/pages/admin/Customers'
import AdminArticles from '@/pages/admin/Articles'
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

import EmployeeDashboard from '@/pages/employee/Dashboard'
import EmployeeInput from '@/pages/employee/InputPekerjaan'
import EmployeeRiwayatPekerjaan from '@/pages/employee/RiwayatPekerjaan'
import EmployeeRiwayatGaji from '@/pages/employee/RiwayatGaji'
import EmployeeKasbon from '@/pages/employee/Kasbon'
import EmployeeProfile from '@/pages/employee/Profile'
import EmployeeAbsensi from '@/pages/employee/Absensi'
import EmployeeTasks from '@/pages/employee/Tasks'

function HomeRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'admin' ? '/admin' : '/app'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<Login />} />

        <Route element={<RequireAuth allow="admin" />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/employees" element={<AdminEmployees />} />
            <Route path="/admin/customers" element={<AdminCustomers />} />
            <Route path="/admin/articles" element={<AdminArticles />} />
            <Route path="/admin/worklogs" element={<AdminWorkLogs />} />
            <Route path="/admin/payroll" element={<AdminPayroll />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/kasbon" element={<AdminKasbon />} />
            <Route path="/admin/attendance" element={<AdminAttendance />} />
            <Route path="/admin/orders" element={<AdminOrders />} />
            <Route path="/admin/orders/:id" element={<AdminTaskDetail />} />
            <Route path="/admin/order" element={<AdminOrder />} />
            <Route path="/admin/order/:id" element={<AdminOrderDetail />} />
            <Route path="/admin/surat-jalan" element={<AdminSuratJalan />} />
            <Route path="/admin/surat-jalan/:id" element={<AdminSuratJalanDetail />} />
            <Route path="/admin/kalender-produksi" element={<AdminKalenderProduksi />} />
            <Route path="/admin/lembar-po" element={<AdminLembarPO />} />
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
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
