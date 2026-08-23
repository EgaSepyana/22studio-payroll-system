import { EmployeesRepo } from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';

export async function getProfile(user) {
  if (user.role === 'admin' || user.role === 'admin_produksi' || user.role === 'owner') {
    return { username: user.username, role: user.role };
  }
  const employee = await EmployeesRepo.getById(user.employee_id);
  if (!employee) throw new ApiError(404, 'Profil tidak ditemukan');
  return { username: user.username, role: user.role, name: employee.name, phone: employee.phone };
}

export async function updatePhone(user, phone) {
  if (user.role !== 'employee') throw new ApiError(400, 'Hanya karyawan yang memiliki profil ini');
  const updated = await EmployeesRepo.updateById(user.employee_id, { phone });
  if (!updated) throw new ApiError(404, 'Profil tidak ditemukan');
  return { name: updated.name, phone: updated.phone };
}
