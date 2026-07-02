import { AttendanceRepo, EmployeesRepo, FINISHING_DIVISION } from '../google-sheet/models.js';
import { ApiError } from '../utils/response.js';

function clean(record) {
  const { _rowNumber, ...rest } = record;
  return rest;
}

async function enrich(record) {
  const employee = await EmployeesRepo.getById(record.employee_id);
  return {
    ...clean(record),
    hours: record.hours === '' ? null : Number(record.hours),
    employee_name: employee?.name || null,
  };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function computeHours(checkIn, checkOut) {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(0, Math.round((ms / 3600000) * 100) / 100); // hours, 2 decimal places
}

export async function checkIn(employeeId) {
  const employee = await EmployeesRepo.getById(employeeId);
  if (!employee) throw new ApiError(400, 'Karyawan tidak valid');
  if (employee.divisi !== FINISHING_DIVISION) {
    throw new ApiError(400, 'Fitur absensi hanya untuk divisi Finishing');
  }

  const today = todayStr();
  const all = await AttendanceRepo.getAll({ fresh: true });
  const existing = all.find((a) => String(a.employee_id) === String(employeeId) && a.date === today);
  if (existing) throw new ApiError(400, 'Sudah melakukan check-in hari ini');

  const record = await AttendanceRepo.insert({
    employee_id: employeeId,
    date: today,
    check_in: new Date().toISOString(),
    check_out: '',
    hours: '',
    payroll_id: '',
    notes: '',
  });
  return enrich(record);
}

export async function checkOut(employeeId) {
  const today = todayStr();
  const all = await AttendanceRepo.getAll({ fresh: true });
  const existing = all.find((a) => String(a.employee_id) === String(employeeId) && a.date === today);
  if (!existing) throw new ApiError(400, 'Belum melakukan check-in hari ini');
  if (existing.check_out) throw new ApiError(400, 'Sudah melakukan check-out hari ini');

  const checkOutTime = new Date().toISOString();
  const hours = computeHours(existing.check_in, checkOutTime);
  const updated = await AttendanceRepo.updateById(existing.id, { check_out: checkOutTime, hours });
  return enrich(updated);
}

export async function getTodayStatus(employeeId) {
  const today = todayStr();
  const all = await AttendanceRepo.getAll();
  const existing = all.find((a) => String(a.employee_id) === String(employeeId) && a.date === today);
  return existing ? enrich(existing) : null;
}

export async function listAttendance(filters = {}) {
  let rows = await AttendanceRepo.getAll();

  if (filters.employee_id) {
    rows = rows.filter((a) => String(a.employee_id) === String(filters.employee_id));
  }
  if (filters.date_from) {
    rows = rows.filter((a) => a.date >= filters.date_from);
  }
  if (filters.date_to) {
    rows = rows.filter((a) => a.date <= filters.date_to);
  }
  if (filters.divisi) {
    const employees = await EmployeesRepo.getAll();
    const idsInDivisi = new Set(
      employees.filter((e) => e.divisi === filters.divisi).map((e) => String(e.id))
    );
    rows = rows.filter((a) => idsInDivisi.has(String(a.employee_id)));
  }

  rows.sort((a, b) => (a.date < b.date ? 1 : -1));
  return Promise.all(rows.map(enrich));
}

// Admin manual entry — used for corrections (forgotten check-out, missed day, etc).
export async function createAttendance({ employee_id, date, check_in, check_out, notes }) {
  const employee = await EmployeesRepo.getById(employee_id);
  if (!employee) throw new ApiError(400, 'Karyawan tidak valid');

  const hours = check_in && check_out ? computeHours(check_in, check_out) : '';

  const record = await AttendanceRepo.insert({
    employee_id,
    date,
    check_in: check_in || '',
    check_out: check_out || '',
    hours,
    payroll_id: '',
    notes: notes || '',
  });
  return enrich(record);
}

export async function updateAttendance(id, patch) {
  const existing = await AttendanceRepo.getById(id);
  if (!existing) throw new ApiError(404, 'Data absensi tidak ditemukan');
  if (existing.payroll_id) throw new ApiError(400, 'Tidak dapat mengubah absensi yang sudah dibayar');

  const nextCheckIn = patch.check_in !== undefined ? patch.check_in : existing.check_in;
  const nextCheckOut = patch.check_out !== undefined ? patch.check_out : existing.check_out;
  const hours = nextCheckIn && nextCheckOut ? computeHours(nextCheckIn, nextCheckOut) : '';

  const updated = await AttendanceRepo.updateById(id, { ...patch, hours });
  return enrich(updated);
}

export async function deleteAttendance(id) {
  const existing = await AttendanceRepo.getById(id);
  if (!existing) throw new ApiError(404, 'Data absensi tidak ditemukan');
  if (existing.payroll_id) throw new ApiError(400, 'Tidak dapat menghapus absensi yang sudah dibayar');
  await AttendanceRepo.deleteById(id);
}
