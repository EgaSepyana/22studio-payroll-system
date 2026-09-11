import Redis from 'ioredis';
import { env } from './env.js';

// Module-level singleton, reused across requests within one warm serverless
// instance — a client created per-request would open a new TCP+TLS
// connection on every invocation and never reliably close it, which burns
// through Upstash's connection limit fast. lazyConnect defers the actual
// connect() until the first command instead of at import time, so simply
// importing this module (e.g. from a route that never touches Redis) never
// pays a connection cost.
let client = null;

export function getRedis() {
  if (!env.redisUrl) return null;
  if (client) return client;

  client = new Redis(env.redisUrl, {
    // Upstash Redis only ever supports db 0 — a real SELECT here would be
    // rejected ("ERR Only 0th database is supported!"). REDIS_QUEUE_DB is
    // used as a logical key-namespace prefix instead (see
    // notificationService's QUEUE_KEY), not passed to the client at all.
    lazyConnect: true,
    // A serverless invocation only has seconds to live — a client stuck
    // endlessly retrying a dead connection would hang the whole request.
    // Capped, fast-failing retry instead of ioredis's infinite-by-default
    // backoff.
    maxRetriesPerRequest: 2,
    retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
    // Upstash requires TLS (rediss://) — ioredis infers this from the URL
    // scheme already, this just silences a Node TLS warning some Upstash
    // endpoints otherwise trigger over self-signed intermediate certs.
    tls: env.redisUrl.startsWith('rediss://') ? {} : undefined,
  });

  client.on('error', (err) => {
    // Never let an unhandled Redis error crash the whole function — every
    // call site below already treats a Redis failure as "queue unavailable,
    // fall back to sheet-only" rather than a hard failure.
    console.error('Redis client error:', err.message);
  });

  return client;
}

// Prefixes a key with REDIS_QUEUE_DB as a logical namespace (see the "only
// db 0" comment above) — lets several logical queues coexist on this one
// physical Upstash instance/db without their keys colliding, which is what
// REDIS_QUEUE_DB was actually for even though it can't be a real SELECT.
export function queueKey(name) {
  return `q${env.redisQueueDb}:${name}`;
}
