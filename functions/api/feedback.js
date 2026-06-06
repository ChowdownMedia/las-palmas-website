/* POST /api/feedback — save a submitted feedback record (FeedbackPortalV3 server side).
   Field set is Glenn's stable submission shape: location, overallRating, ratings[],
   comments, serverName, guestName, phone, permissionToUsePublicly, responses,
   submittedAt, concern (concern is set later by the model via /api/feedback-ai).

   IN : the submission payload (id optional — generated here if missing)
   OUT: { ok: true, id }
*/
import { json, badRequest, readJson } from './_shared.js';

const LOCATIONS = ['Shorter', 'Riverside', 'Rockmart', 'Cartersville'];
const NAME_MAX = 100;
const COMMENT_MAX = 2000;

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body) return badRequest('json body required');

  const location = String(body.location || '');
  if (!LOCATIONS.includes(location)) return badRequest('valid location required');
  const overall = Math.max(0, Math.min(5, Number(body.overallRating) || 0));
  if (!(overall > 0)) return badRequest('overall rating required');

  const id = (String(body.id || '').match(/^fb_[a-z0-9]{1,12}$/) ? body.id
    : 'fb_' + Math.random().toString(36).slice(2, 8));
  const ratings = Array.isArray(body.ratings)
    ? body.ratings.slice(0, 20).map((r) => ({
        label: String(r.label || '').slice(0, 60),
        value: Math.max(0, Math.min(5, Number(r.value) || 0)),
      }))
    : [];
  const submittedAt = new Date().toISOString();

  // Deterministic auto-flag: any low overall rating is flagged for review the
  // instant it's submitted — never dependent on the AI thank-you assessment
  // (which can miss). The model may still ADD concern later for higher-rated
  // reviews (food safety, threats, etc.); it only ever sets concern, never clears.
  const FLAG_AT_OR_BELOW = 2;
  const concern = overall > 0 && overall <= FLAG_AT_OR_BELOW ? 1 : 0;

  const db = env.DB;
  if (!db) return json({ error: 'storage_unavailable' }, 503);
  await db.prepare(
    `INSERT INTO feedback_records
       (id, location, overall_rating, ratings, comments, server_name, guest_name,
        phone, permission_public, responses, concern, submitted_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`
  ).bind(
    id,
    location,
    overall,
    JSON.stringify(ratings),
    String(body.comments || '').slice(0, COMMENT_MAX * 2),
    String(body.serverName || '').slice(0, NAME_MAX),
    String(body.guestName || '').slice(0, NAME_MAX),
    String(body.phone || '').slice(0, 20),
    body.permissionToUsePublicly ? 1 : 0,
    JSON.stringify(body.responses || {}).slice(0, 20000),
    concern,
    submittedAt
  ).run();

  return json({ ok: true, id, concern: !!concern });
}
