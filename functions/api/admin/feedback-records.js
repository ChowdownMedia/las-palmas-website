/* GET /api/admin/feedback-records — list feedback for the CRM (newest first). */
import { json } from '../_shared.js';
import { requireAdmin } from './_auth.js';

export async function onRequestGet({ request, env }) {
  const guard = await requireAdmin(request, env); if (guard) return guard;

  const res = await env.DB.prepare(
    `SELECT id, location, overall_rating, ratings, comments, server_name, guest_name,
            phone, permission_public, followups, concern, submitted_at
     FROM feedback_records ORDER BY submitted_at DESC LIMIT 500`
  ).all();

  const safe = (s) => { try { return JSON.parse(s); } catch (e) { return []; } };
  return json({
    records: (res.results || []).map((r) => ({
      id: r.id,
      location: r.location,
      overallRating: r.overall_rating,
      ratings: safe(r.ratings),
      comments: r.comments || '',
      serverName: r.server_name || '',
      guestName: r.guest_name || '',
      phone: r.phone || '',
      permissionPublic: !!r.permission_public,
      followups: safe(r.followups),
      concern: !!r.concern,
      submittedAt: r.submitted_at,
    })),
  });
}
