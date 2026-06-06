/* PATCH  /api/admin/feedback-record — { id, concern } flag/unflag.
   DELETE /api/admin/feedback-record — { id } remove a feedback record. */
import { json, badRequest, readJson } from '../_shared.js';
import { requireAdmin } from './_auth.js';

export async function onRequestPatch({ request, env }) {
  const guard = await requireAdmin(request, env); if (guard) return guard;
  const body = await readJson(request);
  if (!body || !body.id) return badRequest('id required');
  if (typeof body.concern !== 'boolean') return badRequest('concern required');
  await env.DB.prepare('UPDATE feedback_records SET concern = ?2 WHERE id = ?1')
    .bind(String(body.id), body.concern ? 1 : 0).run();
  return json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  const guard = await requireAdmin(request, env); if (guard) return guard;
  const body = await readJson(request);
  if (!body || !body.id) return badRequest('id required');
  await env.DB.prepare('DELETE FROM feedback_records WHERE id = ?1').bind(String(body.id)).run();
  return json({ ok: true });
}
