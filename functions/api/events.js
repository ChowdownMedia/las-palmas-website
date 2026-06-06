/* GET /api/events — public list of upcoming events for /events/ (today onward,
   soonest first). Past events are hidden from guests but kept for the admin. */
import { json } from './_shared.js';

export async function onRequestGet({ env }) {
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC; close enough for all-day events)
    const res = await env.DB.prepare(
      'SELECT id, date, time, title, description, locations, image FROM events WHERE date >= ?1 ORDER BY date ASC LIMIT 100'
    ).bind(today).all();
    const safe = (s) => { try { const a = JSON.parse(s); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
    return json({
      events: (res.results || []).map((r) => ({
        id: r.id, date: r.date, time: r.time || '', title: r.title, description: r.description, locations: safe(r.locations), image: r.image || '',
      })),
    });
  } catch (e) {
    return json({ events: [] });
  }
}
