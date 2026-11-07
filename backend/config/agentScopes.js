// Scope catalog for agent accounts — the contract in
// docs/product/PRD-agent-access.md §2–§3. Pure data plus two helpers; nothing
// here reads env or the sheet. Paths are Express route *patterns* as
// registered (e.g. '/api/orders/:id'), not concrete request URLs.

// Scope given to routes every authenticated agent may call (GET /api/agent/me).
export const ANY_AGENT_SCOPE = '*';

// scope -> routes ('METHOD /pattern') that accept an agent holding it.
export const ROUTE_SCOPES = {
  'dashboard:read': ['GET /api/dashboard/admin'],
  'orders:read': ['GET /api/orders', 'GET /api/orders/:id', 'GET /api/orders/:id/timeline'],
  'orders:write': ['POST /api/orders', 'PUT /api/orders/:id'],
  'orders:items': [
    'POST /api/orders/:id/items',
    'POST /api/orders/:id/items/template',
    'PUT /api/orders/:id/items/:itemId',
    'POST /api/orders/:id/items/:itemId/sizes',
    'PUT /api/orders/:id/items/:itemId/sizes/:sizeId',
  ],
  'orders:status': ['PATCH /api/orders/:id/status'],
  'orders:publish-flag': ['PATCH /api/orders/:id/publish-consent'],
  'orders:public-summary': ['GET /api/agent/orders/public-summary'],
  'orders:read-design': ['GET /api/agent/orders/:id/design-brief'],
  'invoice:read': [
    'GET /api/orders/:id/invoice-pdf',
    'GET /api/orders/:id/invoice-excel',
    'GET /api/orders/:id/dp/preview-pelunasan',
  ],
  'dp:create': ['POST /api/orders/:id/dp'],
  'followup:draft': ['POST /api/orders/:id/follow-up'],
  'tracking-link:read': ['GET /api/orders/:id/tracking-link'],
  'customers:read': ['GET /api/customers'],
  'customers:write': ['POST /api/customers', 'PUT /api/customers/:id', 'PUT /api/customers/:id/categories'],
  'articles:read': ['GET /api/articles', 'GET /api/article-categories'],
  'tasks:read': ['GET /api/tasks', 'GET /api/tasks/:id', 'GET /api/tasks/:id/progress-photos'],
  'tasks:write': ['POST /api/tasks', 'PUT /api/tasks/:id'],
  'tasks:progress': ['POST /api/tasks/:id/progress'],
  'lembar-po:read': [
    'GET /api/lembar-po',
    'GET /api/lembar-po/by-order/:orderId',
    'GET /api/lembar-po/order-ids',
    'GET /api/lembar-po/:id',
    'GET /api/lembar-po/:id/pdf',
  ],
  'lembar-po:write': ['POST /api/lembar-po', 'PUT /api/lembar-po/:id'],
  'surat-jalan:read': ['GET /api/surat-jalan', 'GET /api/surat-jalan/:id', 'GET /api/surat-jalan/:id/pdf'],
  'surat-jalan:write': [
    'POST /api/surat-jalan',
    'PUT /api/surat-jalan/:id',
    'POST /api/surat-jalan/:id/items',
    'PUT /api/surat-jalan/:id/items/:itemId',
  ],
  'worklogs:read': ['GET /api/worklogs', 'GET /api/worklogs/export', 'GET /api/worklogs/:id'],
  'finance:read': [
    'GET /api/owner/dashboard',
    'GET /api/owner/income',
    'GET /api/owner/expenses',
    'GET /api/owner/expenses/order-picker',
    'GET /api/owner/expenses/order-profitability/:orderId',
    'GET /api/owner/cash/accounts',
    'GET /api/owner/cash/accounts/balances',
    'GET /api/owner/cash/transfers',
    'GET /api/owner/cash/reconciliations',
    'GET /api/owner/cash/reconciliations/preview-balance',
    'GET /api/owner/assets',
    'GET /api/owner/assets/:id',
    'GET /api/owner/liabilities',
    'GET /api/owner/liabilities/:id',
    'GET /api/owner/inventory',
    'GET /api/owner/inventory/:id',
    'GET /api/cash-accounts',
  ],
  'reports:read': [
    'GET /api/owner/reports/profit-loss',
    'GET /api/owner/reports/balance-sheet',
    'GET /api/reports',
    'GET /api/reports/export',
  ],
  'payroll:read': ['GET /api/payroll', 'GET /api/payroll/range', 'GET /api/payroll/export', 'GET /api/payroll/:id'],
  'payroll:pay': ['PATCH /api/payroll/:id/pay', 'PATCH /api/payroll/range/pay'],
  'cashadvances:read': ['GET /api/cashadvances', 'GET /api/cashadvances/:id'],
  'cashadvances:decide': ['PATCH /api/cashadvances/:id/approve', 'PATCH /api/cashadvances/:id/reject'],
  'expenses:create': ['POST /api/owner/expenses'],
  'income:create': ['POST /api/owner/income'],
  'cash:transfer': ['POST /api/owner/cash/transfers'],
  'cash:reconcile': ['POST /api/owner/cash/reconciliations'],
  'liabilities:pay': ['POST /api/owner/liabilities/:id/payments'],
  'assets:trade': ['POST /api/owner/assets/buy', 'POST /api/owner/assets/sell'],
  'inventory:stock': ['POST /api/owner/inventory/stock-in', 'POST /api/owner/inventory/stock-out'],
  'cms:read': [
    'GET /api/cms/general',
    'GET /api/cms/founders-promise',
    'GET /api/cms/contact-info',
    'GET /api/cms/:section',
  ],
  'cms:write': [
    'PUT /api/cms/general',
    'PUT /api/cms/founders-promise',
    'PUT /api/cms/contact-info',
    'POST /api/cms/:section',
    'PUT /api/cms/:section/reorder',
    'PUT /api/cms/:section/:id',
  ],
  'uploads:cms-image': ['POST /api/uploads/cms-image'],
  'uploads:design': ['POST /api/uploads/design'],
  [ANY_AGENT_SCOPE]: ['GET /api/agent/me'],
};

// Routes in ROUTE_SCOPES that are added by the agent-access plan (T5) and so
// may not be registered in the app yet.
export const NEW_ENDPOINTS = [
  'PATCH /api/orders/:id/status',
  'PATCH /api/orders/:id/publish-consent',
  'GET /api/agent/orders/public-summary',
  'GET /api/agent/orders/:id/design-brief',
  'GET /api/agent/me',
];

export const AGENT_SCOPES = Object.freeze(Object.keys(ROUTE_SCOPES).filter((s) => s !== ANY_AGENT_SCOPE));

export const AGENT_ACCOUNTS = [
  { username: 'agent-manager', scopes: ['orders:read', 'tasks:read', 'dashboard:read'] },
  { username: 'agent-owner', scopes: ['orders:read', 'finance:read', 'reports:read'] },
  {
    username: 'agent-produksi',
    scopes: [
      'orders:read',
      'orders:status',
      'tasks:read',
      'tasks:write',
      'tasks:progress',
      'lembar-po:read',
      'lembar-po:write',
      'surat-jalan:read',
      'surat-jalan:write',
      'worklogs:read',
    ],
  },
  {
    username: 'agent-admin',
    scopes: [
      'orders:read',
      'orders:write',
      'orders:items',
      'orders:publish-flag',
      'customers:read',
      'customers:write',
      'dp:create',
      'invoice:read',
      'followup:draft',
      'tracking-link:read',
      'articles:read',
    ],
  },
  {
    username: 'agent-marketing',
    scopes: ['articles:read', 'orders:public-summary', 'cms:read', 'cms:write', 'uploads:cms-image'],
  },
  { username: 'agent-designer', scopes: ['orders:read-design', 'articles:read', 'uploads:design'] },
  {
    username: 'agent-keuangan',
    scopes: [
      'finance:read',
      'reports:read',
      'payroll:read',
      'worklogs:read',
      'cashadvances:read',
      'expenses:create',
      'income:create',
      'payroll:pay',
      'cashadvances:decide',
      'cash:transfer',
      'cash:reconcile',
      'liabilities:pay',
      'assets:trade',
      'inventory:stock',
    ],
  },
];

// No agent may reach these, whatever the sheet says: a route matching a rule
// never resolves to a scope. `methods: null` = every method; a rule matches
// its `prefix` itself and everything below it.
export const FORBIDDEN_ROUTE_RULES = [
  { methods: ['DELETE'], prefix: '/' },
  { methods: null, prefix: '/api/settings' },
  { methods: null, prefix: '/api/owner/settings' },
  { methods: ['POST', 'PUT', 'PATCH'], prefix: '/api/owner/cash/accounts' },
  { methods: null, prefix: '/api/employees' },
  { methods: null, prefix: '/api/attendance' },
  { methods: null, prefix: '/api/auth' },
  { methods: null, prefix: '/api/profile' },
  { methods: null, prefix: '/api/notifications' },
  { methods: null, prefix: '/api/public' },
];

function normalizePath(path) {
  const clean = String(path).split('?')[0].replace(/\/+/g, '/');
  return clean.length > 1 ? clean.replace(/\/$/, '') : clean;
}

function routeKey(method, path) {
  return `${String(method).toUpperCase()} ${normalizePath(path)}`;
}

const SCOPE_BY_ROUTE = new Map(
  Object.entries(ROUTE_SCOPES).flatMap(([scope, routes]) => routes.map((route) => [route, scope]))
);

export function isForbiddenRoute(method, path) {
  const m = String(method).toUpperCase();
  const p = normalizePath(path);
  return FORBIDDEN_ROUTE_RULES.some(
    ({ methods, prefix }) =>
      (methods === null || methods.includes(m)) && (prefix === '/' || p === prefix || p.startsWith(`${prefix}/`))
  );
}

// The scope an agent needs for a route pattern, ANY_AGENT_SCOPE for routes
// open to every agent, or null when agents are not allowed at all.
export function scopeForRoute(method, path) {
  if (isForbiddenRoute(method, path)) return null;
  return SCOPE_BY_ROUTE.get(routeKey(method, path)) ?? null;
}

export function hasScope(user, scope) {
  if (!user || user.role !== 'agent') return false;
  if (scope === ANY_AGENT_SCOPE) return true;
  if (!AGENT_SCOPES.includes(scope)) return false;
  const scopes = user.scopes;
  if (scopes instanceof Set) return scopes.has(scope);
  return Array.isArray(scopes) && scopes.includes(scope);
}
