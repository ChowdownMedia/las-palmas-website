/* GET /api/terms?surface=chat|feedback — public read of the editable Terms of Use.
   The chat + feedback pages fetch this when their terms modal opens; each page
   keeps its baked terms as a fallback if this read fails. */
import { json, badRequest } from './_shared.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const surface = url.searchParams.get('surface');
  if (surface !== 'chat' && surface !== 'feedback') return badRequest('surface must be chat or feedback');
  try {
    const row = await env.DB.prepare('SELECT content, updated_at FROM site_terms WHERE surface = ?1').bind(surface).first();
    if (!row) return json({ content: null, updatedAt: null });
    return json({ content: row.content, updatedAt: row.updated_at });
  } catch (e) {
    return json({ content: null, updatedAt: null });
  }
}
