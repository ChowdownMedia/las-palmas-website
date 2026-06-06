/* GET /api/admin/chat-threads — list chat threads for the CRM (newest first),
   each with its full transcript. Admin-only. */
import { json } from '../_shared.js';
import { requireAdmin } from './_auth.js';

export async function onRequestGet({ request, env }) {
  const guard = await requireAdmin(request, env); if (guard) return guard;

  const threads = await env.DB.prepare(
    `SELECT id, started_at, last_at, flagged, flag_reason, read
     FROM chat_threads ORDER BY last_at DESC LIMIT 500`
  ).all();
  const rows = threads.results || [];
  if (!rows.length) return json({ threads: [] });

  const msgs = await env.DB.prepare(
    `SELECT thread_id, role, text, ts FROM chat_messages
     WHERE thread_id IN (SELECT id FROM chat_threads ORDER BY last_at DESC LIMIT 500)
     ORDER BY id ASC`
  ).all();
  const byThread = {};
  for (const m of (msgs.results || [])) {
    (byThread[m.thread_id] || (byThread[m.thread_id] = [])).push({ role: m.role, text: m.text, ts: m.ts });
  }

  return json({
    threads: rows.map((t) => ({
      id: t.id,
      startedAt: t.started_at,
      lastAt: t.last_at,
      flagged: !!t.flagged,
      flagReason: t.flag_reason || '',
      read: !!t.read,
      messages: byThread[t.id] || [],
    })),
  });
}
