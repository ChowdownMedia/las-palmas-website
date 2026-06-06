/* POST /api/admin/login — { password } → { ok, token, expiresAt }.
   Username is fixed to the back office; only the shared password is checked. */
import { json, badRequest, readJson } from '../_shared.js';
import { safeEqual, newToken, createSession } from './_auth.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body) return badRequest('json body required');
  const secret = env.ADMIN_PASSWORD;
  if (!secret) return json({ error: 'auth_not_configured' }, 503);
  if (!safeEqual(body.password, secret)) {
    return json({ error: 'invalid_password' }, 401);
  }
  const token = newToken();
  const expiresAt = await createSession(env, token);
  return json({ ok: true, token, expiresAt });
}
