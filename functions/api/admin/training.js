/* /api/admin/training — CRUD for the assistant's knowledge base (training_entries).
   GET    → { entries:[{id,category,scope,title,content,sortOrder}] }
   POST   → { category, scope, title, content } → create (appended to its bucket)
   PATCH  → { id, title?, content?, sortOrder? } → update
   DELETE → { id }
   All guarded. Editing here changes the live chat assistant (compiled at request time). */
import { json, badRequest, readJson } from '../_shared.js';
import { requireAdmin } from './_auth.js';

const CATEGORIES = ['identity', 'general', 'guardrails', 'voice', 'menus', 'location', 'seasonal'];
const LOCATIONS = ['Shorter', 'Riverside', 'Cartersville', 'Rockmart'];
const SEASONAL_SCOPES = ['All Locations', ...LOCATIONS];

function newId() {
  const b = new Uint8Array(8); crypto.getRandomValues(b);
  return 'tr-' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

function validScope(category, scope) {
  if (category === 'location') return LOCATIONS.includes(scope);
  if (category === 'seasonal') return SEASONAL_SCOPES.includes(scope);
  return scope === '' || scope == null;
}

export async function onRequestGet({ request, env }) {
  const guard = await requireAdmin(request, env); if (guard) return guard;
  const res = await env.DB.prepare(
    'SELECT id, category, scope, title, content, sort_order FROM training_entries ORDER BY category, scope, sort_order'
  ).all();
  return json({
    entries: (res.results || []).map((r) => ({
      id: r.id, category: r.category, scope: r.scope || '',
      title: r.title || '', content: r.content || '', sortOrder: r.sort_order || 0,
    })),
  });
}

export async function onRequestPost({ request, env }) {
  const guard = await requireAdmin(request, env); if (guard) return guard;
  const b = await readJson(request);
  if (!b) return badRequest('json body required');
  const category = String(b.category || '');
  const scope = category === 'location' || category === 'seasonal' ? String(b.scope || '') : '';
  if (!CATEGORIES.includes(category)) return badRequest('invalid category');
  if (!validScope(category, scope)) return badRequest('invalid scope for category');
  const title = String(b.title || '').slice(0, 80).trim() || 'Untitled';
  const content = String(b.content || '').slice(0, 20000);

  const maxRow = await env.DB.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) AS m FROM training_entries WHERE category = ?1 AND scope = ?2'
  ).bind(category, scope).first();
  const id = newId();
  await env.DB.prepare(
    'INSERT INTO training_entries (id, category, scope, title, content, sort_order, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7)'
  ).bind(id, category, scope, title, content, (maxRow.m || 0) + 1, new Date().toISOString()).run();
  return json({ ok: true, id });
}

export async function onRequestPatch({ request, env }) {
  const guard = await requireAdmin(request, env); if (guard) return guard;
  const b = await readJson(request);
  if (!b || !b.id) return badRequest('id required');
  const sets = [], binds = [];
  if (typeof b.title === 'string') { sets.push(`title = ?${binds.length + 2}`); binds.push(b.title.slice(0, 80).trim() || 'Untitled'); }
  if (typeof b.content === 'string') { sets.push(`content = ?${binds.length + 2}`); binds.push(b.content.slice(0, 20000)); }
  if (Number.isFinite(b.sortOrder)) { sets.push(`sort_order = ?${binds.length + 2}`); binds.push(Math.trunc(b.sortOrder)); }
  if (!sets.length) return badRequest('nothing to update');
  sets.push(`updated_at = ?${binds.length + 2}`); binds.push(new Date().toISOString());
  await env.DB.prepare(`UPDATE training_entries SET ${sets.join(', ')} WHERE id = ?1`).bind(String(b.id), ...binds).run();
  return json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  const guard = await requireAdmin(request, env); if (guard) return guard;
  const b = await readJson(request);
  if (!b || !b.id) return badRequest('id required');
  await env.DB.prepare('DELETE FROM training_entries WHERE id = ?1').bind(String(b.id)).run();
  return json({ ok: true });
}
