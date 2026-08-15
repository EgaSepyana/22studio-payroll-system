import bcrypt from 'bcryptjs';
import { EmployeesRepo, UsersRepo } from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';

async function attachUserInfo(employee) {
  const users = await UsersRepo.getAll();
  const user = users.find((u) => String(u.employee_id) === String(employee.id));
  const { _rowNumber, ...rest } = employee;
  return { ...rest, username: user?.username || null };
}

export async function listEmployees() {
  const employees = await EmployeesRepo.getAll();
  return Promise.all(employees.map(attachUserInfo));
}

export async function getEmployee(id) {
  const employee = await EmployeesRepo.getById(id);
  if (!employee) throw new ApiError(404, 'Karyawan tidak ditemukan');
  return attachUserInfo(employee);
}

export async function createEmployee({
  name,
  phone,
  status,
  username,
  password,
  divisi,
  hourly_rate,
  upah_lembur_per_jam,
}) {
  const users = await UsersRepo.getAll({ fresh: true });
  if (users.some((u) => u.username === username)) {
    throw new ApiError(400, 'Username sudah digunakan');
  }

  const employee = await EmployeesRepo.insert({
    name,
    phone,
    status: status || 'active',
    divisi: divisi || '',
    hourly_rate: hourly_rate || '',
    upah_lembur_per_jam: upah_lembur_per_jam || '',
  });

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await UsersRepo.insert({
      username,
      password: passwordHash,
      role: 'employee',
      employee_id: employee.id,
    });
  } catch (err) {
    await EmployeesRepo.deleteById(employee.id);
    throw err;
  }

  return attachUserInfo(employee);
}

export async function updateEmployee(
  id,
  { name, phone, status, username, password, divisi, hourly_rate, upah_lembur_per_jam }
) {
  const employee = await EmployeesRepo.getById(id);
  if (!employee) throw new ApiError(404, 'Karyawan tidak ditemukan');

  const patch = {};
  if (name !== undefined) patch.name = name;
  if (phone !== undefined) patch.phone = phone;
  if (status !== undefined) patch.status = status;
  if (divisi !== undefined) patch.divisi = divisi;
  if (hourly_rate !== undefined) patch.hourly_rate = hourly_rate;
  if (upah_lembur_per_jam !== undefined) patch.upah_lembur_per_jam = upah_lembur_per_jam;
  const updated = Object.keys(patch).length ? await EmployeesRepo.updateById(id, patch) : employee;

  const users = await UsersRepo.getAll({ fresh: true });
  const user = users.find((u) => String(u.employee_id) === String(id));
  if (user && (username || password)) {
    if (username && username !== user.username) {
      if (users.some((u) => u.username === username && u.id !== user.id)) {
        throw new ApiError(400, 'Username sudah digunakan');
      }
    }
    const userPatch = {};
    if (username) userPatch.username = username;
    if (password) userPatch.password = await bcrypt.hash(password, 10);
    await UsersRepo.updateById(user.id, userPatch);
  }

  return attachUserInfo(updated);
}

export async function deleteEmployee(id) {
  const employee = await EmployeesRepo.getById(id);
  if (!employee) throw new ApiError(404, 'Karyawan tidak ditemukan');

  const users = await UsersRepo.getAll({ fresh: true });
  const user = users.find((u) => String(u.employee_id) === String(id));
  if (user) await UsersRepo.deleteById(user.id);
  await EmployeesRepo.deleteById(id);
}
