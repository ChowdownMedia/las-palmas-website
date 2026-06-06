/* Compile the chat assistant's system prompt from training_entries rows.
   Exact port of buildSystemPrompt() in Glenn's LPChatV3.6.jsx — category order,
   headings, and per-location order must match so the D1-driven prompt is
   byte-identical to the baked one until someone edits Training in /admin/. */

export const LOCATIONS = ['Shorter', 'Riverside', 'Cartersville', 'Rockmart'];

const PREAMBLE =
  'You are the Las Palmas Assistant, the on-site chat assistant for Las Palmas Mexican Restaurant. ' +
  'Use ONLY the information below as your source of truth. If something is not covered, say you are ' +
  'not sure and suggest the website or calling the location. Keep replies friendly and concise.';

/* (heading, category, scope) in the exact order buildSystemPrompt emits them. */
function sectionOrder() {
  const out = [
    ['Identity & Persona', 'identity', ''],
    ['Brand Voice', 'voice', ''],
    ['Guardrails', 'guardrails', ''],
    ['General Information', 'general', ''],
    ['Menus', 'menus', ''],
  ];
  LOCATIONS.forEach((loc) => out.push([`Location: ${loc}`, 'location', loc]));
  out.push(['Seasonal / Temporary (All Locations)', 'seasonal', 'All Locations']);
  LOCATIONS.forEach((loc) => out.push([`Seasonal / Temporary: ${loc}`, 'seasonal', loc]));
  return out;
}

/* rows: [{ category, scope, title, content, sort_order }] */
export function compileSystemPrompt(rows) {
  const parts = [];
  for (const [heading, category, scope] of sectionOrder()) {
    const entries = rows
      .filter((r) => r.category === category && (r.scope || '') === scope)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    if (!entries.length) continue;
    parts.push(`# ${heading}`);
    for (const e of entries) {
      if (e && (e.title || e.content)) {
        parts.push(`## ${e.title || 'Untitled'}\n${e.content || ''}`.trim());
      }
    }
  }
  if (!parts.length) {
    return 'You are the Las Palmas Assistant for Las Palmas Mexican Restaurant. Be warm, brief, and helpful.';
  }
  return PREAMBLE + '\n\n' + parts.join('\n\n');
}

/* Load training rows from D1 and compile. Returns null on any failure so the
   caller can fall back to the baked SYSTEM_PROMPT (assistant never breaks). */
export async function compileFromD1(env) {
  try {
    if (!env.DB) return null;
    const res = await env.DB.prepare(
      'SELECT category, scope, title, content, sort_order FROM training_entries'
    ).all();
    const rows = res.results || [];
    if (!rows.length) return null;
    return compileSystemPrompt(rows);
  } catch (e) {
    return null;
  }
}

/* Load CTA rules from D1 (sorted). Returns null on failure → caller falls back. */
export async function loadCtaRules(env) {
  try {
    if (!env.DB) return null;
    const res = await env.DB.prepare(
      'SELECT id, label, keywords, title, body, button_text, url, enabled, smart, smart_instructions FROM cta_rules ORDER BY sort_order ASC'
    ).all();
    const rows = res.results || [];
    if (!rows.length) return null;
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      keywords: safeArr(r.keywords),
      title: r.title,
      body: r.body,
      buttonText: r.button_text,
      url: r.url,
      enabled: !!r.enabled,
      smart: !!r.smart,
      smartInstructions: r.smart_instructions || '',
    }));
  } catch (e) {
    return null;
  }
}

function safeArr(s) { try { const a = JSON.parse(s); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
