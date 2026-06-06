/* Admin back-office auth for the Las Palmas site.
   Password (ADMIN_PASSWORD Pages secret) matches LP AI Command so the team has
   one credential; this side issues its own session token stored in D1
   (admin_sessions). Used by /admin/ — guest pages never touch this. */
import { json } from '../_shared.js';

const SESSION_HOURS = 24;

/* Constant-time-ish string compare (avoids early-exit timing leaks). */
export function safeEqual(a, b) {
  a = String(a || '');
  b = String(b || '');
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function newToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createSession(env, token) {
  const now = new Date();
  const exp = new Date(now.getTime() + SESSION_HOURS * 3600 * 1000);
  // Opportunistic cleanup of expired rows.
  await env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?1').bind(now.toISOString()).run();
  await env.DB.prepare(
    'INSERT INTO admin_sessions (token, created_at, expires_at) VALUES (?1, ?2, ?3)'
  ).bind(token, now.toISOString(), exp.toISOString()).run();
  return exp.toISOString();
}

export function bearer(request) {
  const h = request.headers.get('Authorization') || '';
  return h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : '';
}

export async function validToken(env, token) {
  if (!token) return false;
  const row = await env.DB.prepare(
    'SELECT token FROM admin_sessions WHERE token = ?1 AND expires_at > ?2'
  ).bind(token, new Date().toISOString()).first();
  return !!row;
}

/* Guard for admin API handlers. Returns a 401 Response if not authed, else null. */
export async function requireAdmin(request, env) {
  const ok = await validToken(env, bearer(request));
  return ok ? null : json({ error: 'unauthorized' }, 401);
}
