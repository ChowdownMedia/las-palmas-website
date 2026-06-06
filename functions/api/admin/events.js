/* /api/admin/events — CRUD for events (guarded). Admin sees all (incl. past).
   GET    → { events:[{id,date,title,description,locations}] } (all, soonest first)
   POST   → { date, title, description, locations[] }
   PATCH  → { id, date?, title?, description?, locations? }
   DELETE → { id } */
import { json, badRequest, readJson } from '../_shared.js';
import { requireAdmin } from './_auth.js';

const LOCATIONS = ['Shorter', 'Riverside', 'Cartersville', 'Rockmart'];

function newId() {
  const b = new Uint8Array(8); crypto.getRandomValues(b);
  return 'ev-' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}
function validDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
function cleanLocs(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(String).filter((l) => LOCATIONS.includes(l));
}
const safe = (s) => { try { const a = JSON.parse(s); return Array.isArray(a) ? a : []; } catch (e) { return []; } };

export async function onRequestGet({ request, env }) {
  const guard = await requireAdmin(request, env); if (guard) return guard;
  const res = await env.DB.prepare('SELECT id, date, title, description, locations, image FROM events ORDER BY date ASC').all();
  return json({
    events: (res.results || []).map((r) => ({
      id: r.id, date: r.date, title: r.title, description: r.description, locations: safe(r.locations), image: r.image || '',
    })),
  });
}

export async function onRequestPost({ request, env }) {
  const guard = await requireAdmin(request, env); if (guard) return guard;
  const b = await readJson(request);
  if (!b) return badRequest('json body required');
  if (!validDate(b.date)) return badRequest('date must be YYYY-MM-DD');
  const title = String(b.title || '').slice(0, 120).trim();
  if (!title) return badRequest('title required');
  const id = newId();
  const now = new Date().toISOString();
  await env.DB.prepare(
    'INSERT INTO events (id, date, title, description, locations, image, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?7)'
  ).bind(id, b.date, title, String(b.description || '').slice(0, 1000), JSON.stringify(cleanLocs(b.locations)), String(b.image || '').slice(0, 300), now).run();
  return json({ ok: true, id });
}

export async function onRequestPatch({ request, env }) {
  const guard = await requireAdmin(request, env); if (guard) return guard;
  const b = await readJson(request);
  if (!b || !b.id) return badRequest('id required');
  const sets = [], binds = [];
  if (validDate(b.date)) { sets.push(`date = ?${binds.length + 2}`); binds.push(b.date); }
  if (typeof b.title === 'string') { sets.push(`title = ?${binds.length + 2}`); binds.push(b.title.slice(0, 120).trim()); }
  if (typeof b.description === 'string') { sets.push(`description = ?${binds.length + 2}`); binds.push(b.description.slice(0, 1000)); }
  if (Array.isArray(b.locations)) { sets.push(`locations = ?${binds.length + 2}`); binds.push(JSON.stringify(cleanLocs(b.locations))); }
  if (typeof b.image === 'string') { sets.push(`image = ?${binds.length + 2}`); binds.push(b.image.slice(0, 300)); }
  if (!sets.length) return badRequest('nothing to update');
  sets.push(`updated_at = ?${binds.length + 2}`); binds.push(new Date().toISOString());
  await env.DB.prepare(`UPDATE events SET ${sets.join(', ')} WHERE id = ?1`).bind(String(b.id), ...binds).run();
  return json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  const guard = await requireAdmin(request, env); if (guard) return guard;
  const b = await readJson(request);
  if (!b || !b.id) return badRequest('id required');
  await env.DB.prepare('DELETE FROM events WHERE id = ?1').bind(String(b.id)).run();
  return json({ ok: true });
}
