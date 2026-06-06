/* POST /api/feedback-ai — the post-submission AI assistant (askFeedbackAI server side).
   System prompt and JSON contract are verbatim from FeedbackPortalV3.jsx; the model owns
   harm/concern detection (v3 design). Turn limit is enforced server-side too.

   IN : { id, history: [{role, content}], exchangeCount }
   OUT: { message, question, flag, concern, done }   (flag: "" | "self_harm" | "threat")

   Side effects on the saved record:
     - concern=true  → flips the CRM concern flag
     - exchangeCount > 0 → the newest user turn is appended to the record's followups
*/
import { callModel, aiParseJson, json, badRequest, readJson } from './_shared.js';

const AI_MAX_EXCHANGES = 2;
const FOLLOWUP_MAX = 500;
const HISTORY_MAX = 2 + AI_MAX_EXCHANGES * 2; // summary + assistant/user pairs

function buildSystem(exchangeCount) {
  return (
    "You are the post-submission feedback assistant for Las Palmas Mexican Restaurant, a " +
    "family-owned group with FOUR locations: Shorter, Riverside, Rockmart, and Cartersville. " +
    "Armuchee and Dalton are NOT part of this group. " +
    "The guest has ALREADY submitted their feedback — it is saved no matter what. Reply with a " +
    "short, warm, genuinely human message, and ONLY when there are loose ends, ask ONE low-friction " +
    "OPTIONAL follow-up question. The guest cannot chat freely; you prompt them, only if needed. " +
    "Respond with ONLY a JSON object (no markdown): " +
    '{"message":"2-4 sentences, warm and personal","question":"one optional question or empty","flag":"","concern":false,"done":true}. ' +
    "MESSAGE RULES: " +
    "Use the guest's first name once, naturally, if provided. " +
    "5 stars and positive/no complaint → specific, warm thank-you; NO question; done=true. " +
    "4 or 3 stars → thank them, acknowledge it fell short of perfect, and gently ask (question) how you " +
    "could have made it better — low friction. " +
    "1-2 stars or clearly negative → sincere, specific apology. NEVER offer or promise anything: no refund, " +
    "gift card, discount, free item, or guaranteed callback. If they already explained in detail, just " +
    "apologize personally (question empty, done=true). If key context is missing, ask for the SINGLE most " +
    "useful missing detail (e.g. the day/time, where they were seated, or which server) — one question, not a list. " +
    "If the guest mentions a bad experience at Armuchee or Dalton, kindly clarify those locations are not part " +
    "of our management group so we can't act on it. " +
    "If the guest demands/asks for a refund, gift card, or compensation, do NOT agree or guarantee anything; say " +
    "you can't promise that, but you'll pass their information to upper management and someone may reach out " +
    "(never guarantee a callback). " +
    "If the experience was negative and there is NO contact phone on file, you MAY use `question` to invite " +
    "(optional) a name and phone or email so management can follow up if appropriate. " +
    "Never robotic or corporate; warm, specific, human. " +
    "SAFETY (judge genuine intent, not idioms — e.g. \\\"this wait is killing me\\\" is NOT self-harm): " +
    "If the guest genuinely expresses self-harm or suicidal thoughts anywhere (including disguised " +
    "spellings, slang, or euphemisms like 'kms', 'unalive', 'end it all', 'don't want to be here'), set " +
    "flag to \\\"self_harm\\\", keep `message` gentle and caring, set question to \\\"\\\" and done=true. " +
    "If the guest makes a threat of violence toward people, or the content is otherwise harmful/abusive/" +
    "menacing, set flag to \\\"threat\\\", keep `message` brief and neutral, set question to \\\"\\\" and done=true. " +
    "CONCERN FLAG: set concern=true whenever this feedback is something management should review — e.g. " +
    "self-harm, threats, a serious complaint (food safety/illness, injury, discrimination, harassment, an " +
    "abusive or hostile guest), or anything alarming. Set concern=false for ordinary positive or mildly " +
    "negative feedback. Use judgment; flag genuine concerns, not routine criticism. " +
    `TURN LIMIT: this is guest reply #${exchangeCount} of a maximum ${AI_MAX_EXCHANGES}. ` +
    `If ${exchangeCount} >= ${AI_MAX_EXCHANGES}, you MUST set question to "" and done=true.`
  );
}

export async function onRequestPost({ request, env, waitUntil }) {
  const body = await readJson(request);
  if (!body || !Array.isArray(body.history) || !body.history.length) {
    return badRequest('history required');
  }
  const exchangeCount = Math.max(0, Math.min(AI_MAX_EXCHANGES, Number(body.exchangeCount) || 0));
  const id = String(body.id || '').match(/^fb_[a-z0-9]{1,12}$/) ? body.id : null;

  const history = body.history.slice(-HISTORY_MAX).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 4000),
  }));

  let raw;
  try {
    raw = await callModel(env, {
      system: buildSystem(exchangeCount),
      messages: history,
      maxTokens: 1500,
      jsonMode: true,
    });
  } catch (e) {
    return json({ error: 'model_unavailable' }, 502);
  }

  const parsed = aiParseJson(raw);
  const message = parsed && typeof parsed.message === 'string' ? parsed.message.trim() : '';
  let question = parsed && typeof parsed.question === 'string' ? parsed.question.trim() : '';
  const flag = parsed && typeof parsed.flag === 'string' ? parsed.flag.trim() : '';
  const concern = !!(parsed && parsed.concern === true) || flag === 'self_harm' || flag === 'threat';
  let done = !parsed || parsed.done !== false;
  if (exchangeCount >= AI_MAX_EXCHANGES) { question = ''; done = true; } // server-enforced cap

  // Persist model verdict + the guest's follow-up text onto the record.
  if (id && env.DB) {
    const tasks = [];
    if (concern) {
      tasks.push(env.DB.prepare('UPDATE feedback_records SET concern = 1 WHERE id = ?1').bind(id).run());
    }
    if (exchangeCount > 0) {
      const lastUser = [...history].reverse().find((m) => m.role === 'user');
      if (lastUser) {
        const entry = JSON.stringify({ text: lastUser.content.slice(0, FOLLOWUP_MAX), ts: new Date().toISOString() });
        tasks.push(env.DB.prepare(
          `UPDATE feedback_records
           SET followups = json_insert(followups, '$[#]', json(?2))
           WHERE id = ?1`
        ).bind(id, entry).run());
      }
    }
    if (tasks.length) waitUntil(Promise.all(tasks).catch(() => {}));
  }

  return json({ message, question, flag, concern, done });
}
