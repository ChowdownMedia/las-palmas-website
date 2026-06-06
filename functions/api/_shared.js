/* Shared helpers for the Las Palmas Pages Functions.
   Model + limits mirror Glenn's prototypes (LPChatV3.6 / FeedbackPortalV3) —
   the key lives ONLY here as the ANTHROPIC_API_KEY Pages secret, never client-side. */

export const MODEL_NAME = 'claude-sonnet-4-20250514'; // per Glenn's prototypes
export const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

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

/* Call Anthropic. Returns the concatenated text blocks. */
export async function callModel(env, { system, messages, maxTokens }) {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Model HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
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
