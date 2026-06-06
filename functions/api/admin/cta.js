/* /api/admin/cta — CRUD for Direct Links / CTA rules (cta_rules).
   GET    → { rules:[{id,label,keywords,title,body,buttonText,url,enabled,smart,smartInstructions,sortOrder}] }
   POST   → create from full rule body
   PATCH  → { id, ...fields } partial update (toggle enabled/smart, reorder via sortOrder)
   DELETE → { id }
   All guarded. These drive the chat assistant's action cards (detected server-side). */
import { json, badRequest, readJson } from '../_shared.js';
import { requireAdmin } from './_auth.js';

function newId() {
  const b = new Uint8Array(8); crypto.getRandomValues(b);
  return 'custom-' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}
function cleanKeywords(arr) {
  if (!Array.isArray(arr)) return [];
  const seen = new Set(); const out = [];
  for (const k of arr) {
    const v = String(k || '').trim().slice(0, 32);
    if (v && !seen.has(v)) { seen.add(v); out.push(v); }
  }
  return out.slice(0, 40);
}
function validUrl(u) { return /^(https?:\/\/|\/)/i.test(String(u || '')); }

export async function onRequestGet({ request, env }) {
  const guard = await requireAdmin(request, env); if (guard) return guard;
  const res = await env.DB.prepare(
    'SELECT id, label, keywords, title, body, button_text, url, enabled, smart, smart_instructions, sort_order FROM cta_rules ORDER BY sort_order ASC'
  ).all();
  const safe = (s) => { try { const a = JSON.parse(s); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  return json({
    rules: (res.results || []).map((r) => ({
      id: r.id, label: r.label || '', keywords: safe(r.keywords), title: r.title || '', body: r.body || '',
      buttonText: r.button_text || '', url: r.url || '', enabled: !!r.enabled, smart: !!r.smart,
      smartInstructions: r.smart_instructions || '', sortOrder: r.sort_order || 0,
    })),
  });
}

export async function onRequestPost({ request, env }) {
  const guard = await requireAdmin(request, env); if (guard) return guard;
  const b = await readJson(request);
  if (!b) return badRequest('json body required');
  const label = String(b.label || '').slice(0, 40).trim();
  const title = String(b.title || '').slice(0, 60).trim();
  const body = String(b.body || '').slice(0, 120).trim();
  const buttonText = String(b.buttonText || '').slice(0, 28).trim();
  const url = String(b.url || '').slice(0, 300).trim();
  const keywords = cleanKeywords(b.keywords);
  if (!label || !title || !body || !buttonText || !url || !keywords.length) return badRequest('all fields + ≥1 keyword required');
  if (!validUrl(url)) return badRequest('url must start with http(s):// or /');
  const maxRow = await env.DB.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM cta_rules').first();
  const id = newId();
  await env.DB.prepare(
    'INSERT INTO cta_rules (id, label, keywords, title, body, button_text, url, enabled, smart, smart_instructions, sort_order, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)'
  ).bind(id, label, JSON.stringify(keywords), title, body, buttonText, url,
         b.enabled === false ? 0 : 1, b.smart ? 1 : 0, String(b.smartInstructions || '').slice(0, 1000),
         (maxRow.m || 0) + 1, new Date().toISOString()).run();
  return json({ ok: true, id });
}

export async function onRequestPatch({ request, env }) {
  const guard = await requireAdmin(request, env); if (guard) return guard;
  const b = await readJson(request);
  if (!b || !b.id) return badRequest('id required');
  const sets = [], binds = [];
  const add = (col, val) => { sets.push(`${col} = ?${binds.length + 2}`); binds.push(val); };
  if (typeof b.label === 'string') add('label', b.label.slice(0, 40).trim());
  if (Array.isArray(b.keywords)) add('keywords', JSON.stringify(cleanKeywords(b.keywords)));
  if (typeof b.title === 'string') add('title', b.title.slice(0, 60).trim());
  if (typeof b.body === 'string') add('body', b.body.slice(0, 120).trim());
  if (typeof b.buttonText === 'string') add('button_text', b.buttonText.slice(0, 28).trim());
  if (typeof b.url === 'string') { if (!validUrl(b.url)) return badRequest('invalid url'); add('url', b.url.slice(0, 300).trim()); }
  if (typeof b.enabled === 'boolean') add('enabled', b.enabled ? 1 : 0);
  if (typeof b.smart === 'boolean') add('smart', b.smart ? 1 : 0);
  if (typeof b.smartInstructions === 'string') add('smart_instructions', b.smartInstructions.slice(0, 1000));
  if (Number.isFinite(b.sortOrder)) add('sort_order', Math.trunc(b.sortOrder));
  if (!sets.length) return badRequest('nothing to update');
  add('updated_at', new Date().toISOString());
  await env.DB.prepare(`UPDATE cta_rules SET ${sets.join(', ')} WHERE id = ?1`).bind(String(b.id), ...binds).run();
  return json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  const guard = await requireAdmin(request, env); if (guard) return guard;
  const b = await readJson(request);
  if (!b || !b.id) return badRequest('id required');
  await env.DB.prepare('DELETE FROM cta_rules WHERE id = ?1').bind(String(b.id)).run();
  return json({ ok: true });
}
