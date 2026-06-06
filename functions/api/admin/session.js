/* GET  /api/admin/session — { valid } for the current Bearer token (mount check).
   DELETE /api/admin/session — logout (revoke the token). */
import { json } from '../_shared.js';
import { bearer, validToken } from './_auth.js';

export async function onRequestGet({ request, env }) {
  const ok = await validToken(env, bearer(request));
  return json({ valid: ok }, ok ? 200 : 401);
}

export async function onRequestDelete({ request, env }) {
  const token = bearer(request);
  if (token) await env.DB.prepare('DELETE FROM admin_sessions WHERE token = ?1').bind(token).run();
  return json({ ok: true });
}
