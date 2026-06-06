/* PATCH  /api/admin/chat-thread — { id, read?, flagged? } update CRM state.
   DELETE /api/admin/chat-thread — { id } remove a thread + its messages. */
import { json, badRequest, readJson } from '../_shared.js';
import { requireAdmin } from './_auth.js';

export async function onRequestPatch({ request, env }) {
  const guard = await requireAdmin(request, env); if (guard) return guard;
  const body = await readJson(request);
  if (!body || !body.id) return badRequest('id required');
  const id = String(body.id).slice(0, 64);

  const sets = [], binds = [];
  if (typeof body.read === 'boolean') { sets.push(`read = ?${binds.length + 2}`); binds.push(body.read ? 1 : 0); }
  if (typeof body.flagged === 'boolean') {
    sets.push(`flagged = ?${binds.length + 2}`); binds.push(body.flagged ? 1 : 0);
    if (!body.flagged) { sets.push(`flag_reason = ?${binds.length + 2}`); binds.push(''); }
  }
  if (!sets.length) return badRequest('nothing to update');

  await env.DB.prepare(`UPDATE chat_threads SET ${sets.join(', ')} WHERE id = ?1`).bind(id, ...binds).run();
  return json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  const guard = await requireAdmin(request, env); if (guard) return guard;
  const body = await readJson(request);
  if (!body || !body.id) return badRequest('id required');
  const id = String(body.id).slice(0, 64);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM chat_messages WHERE thread_id = ?1').bind(id),
    env.DB.prepare('DELETE FROM chat_threads WHERE id = ?1').bind(id),
  ]);
  return json({ ok: true });
}
