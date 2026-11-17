import express from 'express';

// Express 5 layers don't keep the path a router was mounted at, so record it
// whenever `use(path, ...)` is called. Must be installed before app.js loads.
export function installMountPathRecorder() {
  let proto = Object.getPrototypeOf(express.Router());
  while (!Object.hasOwn(proto, 'use')) proto = Object.getPrototypeOf(proto);
  if (proto.use.recordsMountPath) return;
  const originalUse = proto.use;
  proto.use = function use(first, ...rest) {
    const before = this.stack.length;
    const result = originalUse.call(this, first, ...rest);
    if (typeof first === 'string') {
      for (const layer of this.stack.slice(before)) layer.mountPath = first;
    }
    return result;
  };
  proto.use.recordsMountPath = true;
}

function joinPath(...parts) {
  const joined = parts.join('/').replace(/\/+/g, '/');
  return joined.length > 1 ? joined.replace(/\/$/, '') : joined;
}

// allow()/requireRole()/requireHuman()/requireDivisi() all return a function
// named `routeGuard` (see middleware/auth.js).
function routeGuards(handlers) {
  return handlers.filter((fn) => fn.name === 'routeGuard');
}

function describeGuards(handlers) {
  let auth = 'none';
  let roles = null;
  let divisi = null;
  for (const fn of handlers) {
    if (fn.name === 'requireAuth') auth = 'jwt';
    else if (fn.name === 'requireAuthQueryOrHeader') auth = 'jwt-or-query-token';
    if (fn.roles) roles = roles ? roles.filter((r) => fn.roles.includes(r)) : [...fn.roles];
    if (fn.divisions) divisi = divisi ? divisi.filter((d) => fn.divisions.includes(d)) : [...fn.divisions];
  }
  return { auth, roles: roles && roles.sort(), divisi: divisi && divisi.sort() };
}

// Walks the router stack in registration order. A guard registered with
// router.use() only applies to routes registered after it, matching how
// Express actually dispatches.
function walk(stack, prefix, inherited, out) {
  const scoped = [...inherited];
  for (const layer of stack) {
    if (layer.route) {
      const handlers = [...scoped, ...layer.route.stack.map((l) => l.handle)];
      const path = joinPath(prefix, layer.route.path);
      for (const method of Object.keys(layer.route.methods)) {
        out.push({
          key: `${method.toUpperCase()} ${path}`,
          method: method.toUpperCase(),
          path,
          chain: routeGuards(handlers),
          ...describeGuards(handlers),
        });
      }
    } else if (layer.handle.stack) {
      walk(layer.handle.stack, joinPath(prefix, layer.mountPath ?? '/'), scoped, out);
    } else {
      scoped.push(layer.handle);
    }
  }
}

export function collectRouteGuards(app) {
  const out = [];
  walk(app.router.stack, '', [], out);
  return out;
}

export function snapshotRouteGuards(app) {
  const snapshot = {};
  for (const { key, auth, roles, divisi } of collectRouteGuards(app)) {
    snapshot[key] = { auth, roles, divisi };
  }
  return Object.fromEntries(Object.entries(snapshot).sort(([a], [b]) => a.localeCompare(b)));
}
