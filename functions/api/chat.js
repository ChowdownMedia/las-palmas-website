/* POST /api/chat — Las Palmas Assistant backend (LPChatV3.6 server side).
   Phase B: training + Direct Links are now read from D1 (editable in /admin/),
   with the baked SYSTEM_PROMPT and DEFAULT_CTA_RULES as fallbacks so the
   assistant never breaks on a bad DB read. CTA detection (keyword + smart) is
   fully server-side — the chat page just renders whatever rule we return.
     1. assistant reply  — system prompt compiled from D1 (fallback baked) + live date
     2. CTA + flag       — keyword match, then one classifier pass for smart intent + CRM flag
     3. CRM logging      — thread + exchange persisted to D1

   IN : { threadId, messages: [{ role:'user'|'assistant', text }] }  (last = newest user turn)
   OUT: { reply, cta: <rule|null>, ruleId, flag, flagReason }
*/
import { SYSTEM_PROMPT } from './_system-prompt.js';
import { callModel, currentDateContext, json, badRequest, readJson } from './_shared.js';
import { compileFromD1, loadCtaRules } from './_training.js';

const PROMPT_LIMIT = 10;
const CHAR_LIMIT = 2000;
const MODEL_MAX_TOKENS = 2000; // GPT-5 mini uses part of the budget for reasoning

/* Fallback CTA rules — used only if the D1 read fails. Mirror the seed. */
const DEFAULT_CTA_RULES = [
  { id: 'ordering', label: 'Ordering', keywords: ['order', 'ordering', 'pickup', 'delivery', 'carryout', 'to go', 'takeout'],
    title: 'Ready to order?', body: 'Order online for pickup or delivery.', buttonText: 'Order Online', url: '/order/', enabled: true, smart: true,
    smartInstructions: 'The guest signals they want to buy or get a specific item, e.g. "I’d like to get that", "how do I order this", "can I pick that up", or talks about a menu item like they intend to purchase it.' },
  { id: 'menu', label: 'Menu', keywords: ['menu'], title: 'Want to browse the full menu?', body: 'See our full Las Palmas menu online.', buttonText: 'View Full Menu', url: '/menu/', enabled: true, smart: false, smartInstructions: '' },
  { id: 'vip', label: 'VIP Rewards', keywords: ['vip', 'rewards'], title: 'Interested in VIP rewards?', body: 'Learn more about the Las Palmas VIP program.', buttonText: 'View VIP Program', url: '/tacopete/', enabled: true, smart: false, smartInstructions: '' },
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

/* Keyword CTA detection — port of the prototype's detectCTA, server-side. */
function detectCTA(text, rules) {
  if (!text) return null;
  const lower = text.toLowerCase() + ' ';
  for (const rule of rules) {
    if (!rule.enabled) continue;
    for (const kw of rule.keywords) {
      const pat = new RegExp('(^|[^a-z])' + kw.trim().toLowerCase().replace(/\s+/g, '\\s+') + '([^a-z]|$)', 'i');
      if (pat.test(lower)) return rule;
    }
  }
  return null;
}

async function classifyTurn(env, userText, smartRules) {
  const ruleLines = smartRules
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
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.text || '').slice(0, CHAR_LIMIT) }))
    .filter((m) => m.content.trim());
  if (!history.length) return badRequest('empty messages');

  const userTurns = history.filter((m) => m.role === 'user').length;
  if (userTurns > PROMPT_LIMIT) return badRequest('conversation limit reached');

  const lastUser = [...history].reverse().find((m) => m.role === 'user');

  // Editable knowledge + CTA rules from D1; baked fallbacks keep the assistant alive.
  const systemPrompt = (await compileFromD1(env)) || SYSTEM_PROMPT;
  const ctaRules = (await loadCtaRules(env)) || DEFAULT_CTA_RULES;

  // 1) Assistant reply.
  let reply;
  try {
    reply = await callModel(env, {
      system: systemPrompt + currentDateContext(),
      messages: history,
      maxTokens: MODEL_MAX_TOKENS,
    });
  } catch (e) {
    return json({ error: 'model_unavailable' }, 502);
  }

  // 2) CTA: instant keyword match, then classifier for smart intent + CRM flag.
  const keywordRule = detectCTA(lastUser.content, ctaRules);
  const smartRules = ctaRules.filter((r) => r.enabled && r.smart);
  let smartRuleId = null;
  let flagInfo = heuristicFlag(lastUser.content);
  try {
    const verdict = await classifyTurn(env, lastUser.content, smartRules);
    if (verdict && typeof verdict === 'object') {
      smartRuleId = verdict.ruleId || null;
      if (typeof verdict.flag === 'boolean') flagInfo = { flag: verdict.flag, flagReason: verdict.flagReason || '' };
    }
  } catch (e) { /* keep heuristic */ }

  let cta = keywordRule;
  if (!cta && smartRuleId) cta = ctaRules.find((r) => r.id === smartRuleId && r.enabled) || null;

  // 3) CRM logging (don't block the reply on it).
  waitUntil(logToCrm(env, threadId, lastUser.content, reply, flagInfo).catch(() => {}));

  return json({
    reply,
    cta: cta ? { id: cta.id, label: cta.label, title: cta.title, body: cta.body, buttonText: cta.buttonText, url: cta.url } : null,
    ruleId: cta ? cta.id : null,
    flag: flagInfo.flag,
    flagReason: flagInfo.flagReason,
  });
}
