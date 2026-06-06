/* /api/admin/terms — edit the Terms of Use for each surface (guarded).
   GET   → { terms: { chat:{content,updatedAt}, feedback:{content,updatedAt} } }
   PATCH → { surface, content } → save (stamps updated_at). */
import { json, badRequest, readJson } from '../_shared.js';
import { requireAdmin } from './_auth.js';

const SURFACES = ['chat', 'feedback'];
const MAX = 40000;

export async function onRequestGet({ request, env }) {
  const guard = await requireAdmin(request, env); if (guard) return guard;
  const res = await env.DB.prepare('SELECT surface, content, updated_at FROM site_terms').all();
  const terms = {};
  for (const r of (res.results || [])) terms[r.surface] = { content: r.content, updatedAt: r.updated_at };
  return json({ terms });
}

export async function onRequestPatch({ request, env }) {
  const guard = await requireAdmin(request, env); if (guard) return guard;
  const b = await readJson(request);
  if (!b || !SURFACES.includes(b.surface)) return badRequest('valid surface required');
  if (typeof b.content !== 'string') return badRequest('content required');
  const content = b.content.slice(0, MAX);
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO site_terms (surface, content, updated_at) VALUES (?1, ?2, ?3)
     ON CONFLICT(surface) DO UPDATE SET content = ?2, updated_at = ?3`
  ).bind(b.surface, content, now).run();
  return json({ ok: true, updatedAt: now });
}
