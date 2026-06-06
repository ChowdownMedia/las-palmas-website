/* POST /api/chat — Las Palmas Assistant backend (LPChatV3.6 server side).
   Does what the prototype did in-browser, with the key server-side:
     1. assistant reply  — compiled training system prompt + live date context,
        sent as the real top-level `system` param (per Glenn's BACKEND note)
     2. classifier pass  — smart Direct-Link intent + CRM flag (one strict-JSON call);
        heuristic fallback if the classifier call fails
     3. CRM logging      — thread + exchange persisted to D1 (was localStorage)

   IN : { threadId, messages: [{ role: 'user'|'assistant', text }] }  (last = newest user turn)
   OUT: { reply, ruleId, flag, flagReason }
*/
import { SYSTEM_PROMPT } from './_system-prompt.js';
import { callModel, currentDateContext, json, badRequest, readJson } from './_shared.js';

/* Limits mirror the prototype (enforced server-side per Glenn's handoff notes). */
const PROMPT_LIMIT = 10;
const CHAR_LIMIT = 2000;
const MODEL_MAX_TOKENS = 2000; // GPT-5 mini uses part of the budget for reasoning

/* Smart (intent) Direct-Link rules — from DEFAULT_CTA_RULES; only `ordering` is smart. */
const SMART_RULES = [
  {
    id: 'ordering',
    label: 'Ordering',
    keywords: ['order', 'ordering', 'pickup', 'delivery', 'carryout', 'to go', 'takeout'],
    smartInstructions: 'The guest signals they want to buy or get a specific item, e.g. "I’d like to get that", "how do I order this", "can I pick that up", or talks about a menu item like they intend to purchase it.',
  },
];

/* Heuristic fallback flagging — port of heuristicFlag(). */
const FLAG_TERMS = ['terrible', 'awful', 'worst', 'disgusting', 'rude', 'refund', 'complaint',
  'sick', 'food poisoning', 'hair in', 'cold food', 'never coming back', 'horrible', 'overcharged',
  'manager', 'lawsuit', 'allergic', 'dirty'];
function heuristicFlag(text) {
  const lower = (text || '').toLowerCase();
  const hit = FLAG_TERMS.find((t) => lower.includes(t));
  return hit ? { flag: true, flagReason: `Mentioned "${hit}"` } : { flag: false, flagReason: '' };
}

async function classifyTurn(env, userText) {
  const ruleLines = SMART_RULES
    .map((r) => `- id "${r.id}": ${r.label}. Surface when: ${r.smartInstructions || `the guest expresses intent related to ${r.keywords.join(', ')}`}`)
    .join('\n');
  const sys =
    'You are a silent classifier for a restaurant chat. Respond with ONLY a JSON object, no prose, ' +
    'no markdown fences. Schema: {"ruleId": string|null, "flag": boolean, "flagReason": string}. ' +
    'Set ruleId to the id of the single best-matching link rule if the guest message shows that intent, ' +
    'otherwise null. Set flag to true ONLY for negative reviews, complaints, safety/illness issues, or ' +
    'situations a manager should see; otherwise false. flagReason is a short phrase or "".\n\n' +
    (ruleLines ? `Link rules:\n${ruleLines}` : 'Link rules: (none)');
  const raw = await callModel(env, {
    messages: [{ role: 'user', content: `${sys}\n\n---\nGuest message to classify:\n${userText}` }],
    maxTokens: 600,
    jsonMode: true,
  });
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

async function logToCrm(env, threadId, userText, replyText, flagInfo) {
  const db = env.DB;
  if (!db) return;
  const nowIso = new Date().toISOString();
  const flagged = flagInfo && flagInfo.flag ? 1 : 0;
  const reason = flagged ? (flagInfo.flagReason || 'Flagged') : '';
  await db.prepare(
    `INSERT INTO chat_threads (id, started_at, last_at, flagged, flag_reason)
     VALUES (?1, ?2, ?2, ?3, ?4)
     ON CONFLICT(id) DO UPDATE SET
       last_at = ?2,
       flagged = MAX(flagged, ?3),
       flag_reason = CASE WHEN flag_reason = '' THEN ?4 ELSE flag_reason END,
       read = 0`
  ).bind(threadId, nowIso, flagged, reason).run();
  await db.batch([
    db.prepare('INSERT INTO chat_messages (thread_id, role, text, ts) VALUES (?1, ?2, ?3, ?4)')
      .bind(threadId, 'user', userText, nowIso),
    db.prepare('INSERT INTO chat_messages (thread_id, role, text, ts) VALUES (?1, ?2, ?3, ?4)')
      .bind(threadId, 'assistant', replyText, nowIso),
  ]);
}

export async function onRequestPost({ request, env, waitUntil }) {
  const body = await readJson(request);
  if (!body || !Array.isArray(body.messages) || !body.messages.length) {
    return badRequest('messages required');
  }
  const threadId = String(body.threadId || '').slice(0, 64);
  if (!threadId) return badRequest('threadId required');

  const history = body.messages
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.text || '').slice(0, CHAR_LIMIT),
    }))
    .filter((m) => m.content.trim());
  if (!history.length) return badRequest('empty messages');

  const userTurns = history.filter((m) => m.role === 'user').length;
  if (userTurns > PROMPT_LIMIT) return badRequest('conversation limit reached');

  const lastUser = [...history].reverse().find((m) => m.role === 'user');

  // 1) Assistant reply — real system param (cleaner and cheaper than the priming turn).
  let reply;
  try {
    reply = await callModel(env, {
      system: SYSTEM_PROMPT + currentDateContext(),
      messages: history,
      maxTokens: MODEL_MAX_TOKENS,
    });
  } catch (e) {
    return json({ error: 'model_unavailable' }, 502);
  }

  // 2) Smart-link + CRM flag classifier; heuristic fallback on failure.
  let ruleId = null;
  let flagInfo = heuristicFlag(lastUser.content);
  try {
    const verdict = await classifyTurn(env, lastUser.content);
    if (verdict && typeof verdict === 'object') {
      ruleId = verdict.ruleId || null;
      if (typeof verdict.flag === 'boolean') {
        flagInfo = { flag: verdict.flag, flagReason: verdict.flagReason || '' };
      }
    }
  } catch (e) { /* keep heuristic */ }

  // 3) CRM logging (don't block the reply on it).
  waitUntil(logToCrm(env, threadId, lastUser.content, reply, flagInfo).catch(() => {}));

  return json({ reply, ruleId, flag: flagInfo.flag, flagReason: flagInfo.flagReason });
}
