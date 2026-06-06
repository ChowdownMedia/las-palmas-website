/* POST /api/chat-feedback — thumbs-down on an assistant reply.
   Mirrors the prototype: a thumbs-down immediately flags the conversation for
   management review (empty text = flag only); a written note is appended to
   the thread as a 'feedback' message.

   IN : { threadId, text }   (text optional, ≤200 chars per FEEDBACK_LIMIT)
   OUT: { ok: true }
*/
import { json, badRequest, readJson } from './_shared.js';

const FEEDBACK_LIMIT = 200;

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body) return badRequest('json body required');
  const threadId = String(body.threadId || '').slice(0, 64);
  if (!threadId) return badRequest('threadId required');
  const text = String(body.text || '').slice(0, FEEDBACK_LIMIT).trim();

  const db = env.DB;
  if (db) {
    const nowIso = new Date().toISOString();
    await db.prepare(
      `INSERT INTO chat_threads (id, started_at, last_at, flagged, flag_reason)
       VALUES (?1, ?2, ?2, 1, ?3)
       ON CONFLICT(id) DO UPDATE SET
         last_at = ?2,
         flagged = 1,
         flag_reason = CASE WHEN flag_reason = '' THEN ?3 ELSE flag_reason END,
         read = 0`
    ).bind(threadId, nowIso, 'Guest gave a thumbs-down on a reply').run();
    if (text || body.withMessage) {
      await db.prepare(
        'INSERT INTO chat_messages (thread_id, role, text, ts) VALUES (?1, ?2, ?3, ?4)'
      ).bind(threadId, 'feedback', text || '(thumbs down — no comment)', nowIso).run();
    }
  }
  return json({ ok: true });
}
