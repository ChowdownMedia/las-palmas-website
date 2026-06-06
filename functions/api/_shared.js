/* Shared helpers for the Las Palmas Pages Functions.
   Prompts/limits mirror Glenn's prototypes (LPChatV3.6 / FeedbackPortalV3).
   Model: OpenAI GPT-5 mini on the LAS PALMAS OpenAI key (same key + model as
   LP AI Command on Render) so all Las Palmas AI usage bills to one place.
   The key lives ONLY here as the OPENAI_API_KEY Pages secret, never client-side. */

export const MODEL_NAME = 'gpt-5-mini-2025-08-07'; // matches LP AI Command (verified key access)
export const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export function badRequest(msg) { return json({ error: msg }, 400); }

export async function readJson(request) {
  try { return await request.json(); } catch (e) { return null; }
}

/* Call the model. Returns the reply text.
   GPT-5 mini notes (same as LP AI Command's llm_service):
   - max_completion_tokens, not max_tokens (reasoning uses part of the budget)
   - temperature must be omitted (only the default is supported)
   - jsonMode adds response_format json_object for the strict-JSON passes */
export async function callModel(env, { system, messages, maxTokens, jsonMode }) {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      max_completion_tokens: maxTokens,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...messages,
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Model HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return ((data.choices || [])[0]?.message?.content || '').trim();
}

/* Lenient JSON extraction — mirrors aiParseJson() in Glenn's feedback portal. */
export function aiParseJson(text) {
  if (!text) return null;
  let s = String(text).trim().replace(/```json/gi, '').replace(/```/g, '').trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a !== -1 && b !== -1 && b > a) s = s.slice(a, b + 1);
  try { return JSON.parse(s); } catch (e) { return null; }
}

/* Live date/time block appended to the chat system prompt at send time —
   port of currentDateContext() pinned to the restaurants' timezone. */
export function currentDateContext() {
  const now = new Date();
  const tz = 'America/New_York'; // all four locations are in Georgia
  let dateStr, timeStr;
  try {
    dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: tz });
    timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
  } catch (e) {
    dateStr = now.toDateString();
    timeStr = now.toTimeString();
  }
  return (
    '\n\n# Current Date & Time (live)\n' +
    `Today is ${dateStr}. The current local time is ${timeStr}.\n` +
    'Use this for time-sensitive questions: which day it is for daily specials, whether a ' +
    'location is currently open, and upcoming dates or holidays/events (for example, noting ' +
    'when Cinco de Mayo is approaching). Important: only state hours, open/closed status, or ' +
    'specials if that information is in your knowledge base above. If it is not provided, do ' +
    'not guess — direct the guest to call the location. (Ask which location when needed.)'
  );
}
