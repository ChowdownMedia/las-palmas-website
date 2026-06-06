import { json } from '../_shared.js';
import { requireAdmin } from './_auth.js';
export async function onRequestGet({ request, env }) {
  const guard = await requireAdmin(request, env); if (guard) return guard;
  const l = await env.MEDIA.list({ prefix: 'events/' });
  return json({ objects: (l.objects || []).map((o) => ({ key: o.key, size: o.size, uploaded: o.uploaded })) });
}
