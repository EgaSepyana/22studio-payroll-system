# Order & Task Management — Implementation Task List

Checklist of all changes needed to implement the Order & Task Management feature.

---

## Phase 1: Backend — Data Layer

- [ ] **[MODIFY]** `backend/google-sheet/models.js`
  - Add `ORDER_STATUSES` and `TASK_STATUSES` constants
  - Add `Orders` schema: `['id', 'customer_id', 'article_id', 'order_name', 'total_qty', 'status', 'created_at', 'notes']`
  - Add `Tasks` schema: `['id', 'order_id', 'divisi', 'description', 'target_qty', 'completed_qty', 'assigned_to', 'status', 'created_at']`
  - Add `OrdersRepo` and `TasksRepo` repository instances
  - Add `'task_id'` to the existing `WorkLogs` schema array

- [ ] **Run** `npm run setup-sheets` to create `Orders` and `Tasks` tabs in Google Sheets

---

## Phase 2: Backend — Order CRUD

- [ ] **[NEW]** `backend/services/orderService.js`
  - `createOrder(data)` — insert with status `open`, `created_at` = now
  - `listOrders(filters)` — list with optional `customer_id`, `status` filters; enrich with `customer_name`, `article_name`, computed `progress` (completed tasks / total tasks), `task_count`
  - `getOrderDetail(orderId)` — single order + its tasks array
  - `updateOrder(orderId, data)` — edit name, notes, qty; reject if `completed`
  - `deleteOrder(orderId)` — only if no tasks exist

- [ ] **[NEW]** `backend/controllers/orderController.js`
  - Zod-validated handlers: `create`, `list`, `detail`, `update`, `remove`

- [ ] **[NEW]** `backend/routes/orderRoutes.js`
  - `POST /` — admin
  - `GET /` — admin + employee
  - `GET /:id` — admin + employee
  - `PUT /:id` — admin
  - `DELETE /:id` — admin

---

## Phase 3: Backend — Task CRUD + Pickup

- [ ] **[NEW]** `backend/services/taskService.js`
  - `createTask(data)` — insert under an order, `completed_qty=0`, status `open`
  - `listTasks(filters)` — filter by `order_id`, `divisi`, `status`, `assigned_to`; enrich with order name and employee name
  - `listAvailableTasks(divisi)` — tasks where `assigned_to` is empty, filtered by division
  - `pickUpTask(taskId, employeeId)` — set `assigned_to`, status → `in_progress`; reject if already assigned
  - `releaseTask(taskId, employeeId)` — un-assign if `completed_qty == 0`
  - `getTaskDetail(taskId)` — single task + order info
  - `updateTask(taskId, data)` — admin edit
  - `deleteTask(taskId)` — only if `completed_qty` is 0
  - `incrementCompletedQty(taskId, qty)` — update completed_qty, auto-transition task → `completed` when done, auto-transition parent order when all tasks done
  - `decrementCompletedQty(taskId, qty)` — reverse of increment (for worklog edits/deletes)

- [ ] **[NEW]** `backend/controllers/taskController.js`
  - Zod-validated handlers: `create`, `list`, `listAvailable`, `detail`, `update`, `remove`, `pickUp`, `release`

- [ ] **[NEW]** `backend/routes/taskRoutes.js`
  - `POST /` — admin
  - `GET /` — admin + employee
  - `GET /available` — employee (filtered by their divisi)
  - `GET /mine` — employee (tasks assigned to them)
  - `GET /:id` — admin + employee
  - `PUT /:id` — admin
  - `DELETE /:id` — admin
  - `PATCH /:id/pickup` — employee
  - `PATCH /:id/release` — employee

---

## Phase 4: Backend — WorkLog Modification

- [ ] **[MODIFY]** `backend/services/workLogService.js`
  - `createWorkLog` — accept `task_id` (required for new entries); auto-fill `customer_id` and `article_id` from the task's parent order; after insert call `taskService.incrementCompletedQty`; validate qty ≤ remaining
  - `updateWorkLog` — if quantity changes, adjust task's `completed_qty` (subtract old, add new)
  - `deleteWorkLog` — subtract deleted qty from task's `completed_qty`

- [ ] **[MODIFY]** `backend/controllers/workLogController.js`
  - Add `task_id` to `createSchema` (required string)

---

## Phase 5: Backend — App Registration

- [ ] **[MODIFY]** `backend/app.js`
  - Import and mount `orderRoutes` at `/api/orders`
  - Import and mount `taskRoutes` at `/api/tasks`

---

## Phase 6: Frontend — Types & API Services

- [ ] **[MODIFY]** `frontend/src/types/index.ts`
  - Add `OrderStatus = 'open' | 'in_progress' | 'completed'`
  - Add `TaskStatus = 'open' | 'in_progress' | 'completed'`
  - Add `Order` interface
  - Add `Task` interface
  - Add `OrderDetail` interface (order + tasks[])
  - Add `task_id?: string` to `WorkLog` interface

- [ ] **[NEW]** `frontend/src/services/orderApi.ts`
  - `createOrder`, `listOrders`, `getOrderDetail`, `updateOrder`, `deleteOrder`

- [ ] **[NEW]** `frontend/src/services/taskApi.ts`
  - `createTask`, `listTasks`, `listAvailableTasks`, `listMyTasks`, `getTaskDetail`, `updateTask`, `deleteTask`, `pickUpTask`, `releaseTask`

- [ ] **[MODIFY]** `frontend/src/services/workLogApi.ts`
  - Add `task_id` to `WorkLogInput`

---

## Phase 7: Frontend — Admin Pages

- [ ] **[NEW]** `frontend/src/pages/admin/Orders.tsx`
  - Order list table with filters (customer, status) and progress bars
  - Create Order dialog (customer, article, name, total_qty, notes)
  - Order detail view — shows order info + tasks list underneath
  - Add Task dialog inside detail (divisi, description, target_qty)
  - Edit/Delete order actions
  - Each task row: divisi, description, target/completed qty, progress bar, assigned employee, status

- [ ] **[MODIFY]** `frontend/src/App.tsx`
  - Add admin route: `/admin/orders` → `Orders.tsx`
  - Add employee route: `/app/tasks` → `Tasks.tsx`

- [ ] **[MODIFY]** `frontend/src/layouts/AdminLayout.tsx`
  - Add "Order & Task" nav item in sidebar

---

## Phase 8: Frontend — Employee Pages

- [ ] **[NEW]** `frontend/src/pages/employee/Tasks.tsx`
  - Two sections: "Tugas Tersedia" (available for pickup) and "Tugas Saya" (assigned to me)
  - Each task card: order name, description, target/completed qty, progress bar
  - "Ambil Tugas" button on available tasks
  - "Lepas Tugas" button on my tasks (only if completed_qty == 0)

- [ ] **[MODIFY]** `frontend/src/pages/employee/InputPekerjaan.tsx`
  - Add required **Task** select (shows only tasks assigned to this employee with status `in_progress`)
  - When task selected → auto-fill customer & article (read-only)
  - Validate qty ≤ remaining (`target_qty - completed_qty`)
  - Remove standalone customer/article selection

- [ ] **[MODIFY]** `frontend/src/layouts/EmployeeLayout.tsx`
  - Add "Tugas" nav item

---

## Phase 9: Verification

- [ ] Run `npm run build` in frontend — zero TypeScript errors
- [ ] Create walkthrough summary
