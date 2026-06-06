/* POST /api/admin/event-image — upload an event flyer/image to R2 (guarded).
   Body = the raw image bytes; Content-Type = the image mime type.
   Returns { ok, key, url } where url (/media/<key>) is what /events/ renders. */
import { json, badRequest } from '../_shared.js';
import { requireAdmin } from './_auth.js';

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const EXT = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

function rand() {
  const b = new Uint8Array(8); crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
  const guard = await requireAdmin(request, env); if (guard) return guard;
  if (!env.MEDIA) return json({ error: 'media_unavailable' }, 503);

  const ct = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  const ext = EXT[ct];
  if (!ext) return badRequest('image must be JPG, PNG, WebP, or GIF');

  const buf = await request.arrayBuffer();
  if (buf.byteLength < 64) return badRequest('empty image');
  if (buf.byteLength > MAX_BYTES) return badRequest('image too large (max 8MB)');

  const key = `events/${rand()}.${ext}`;
  await env.MEDIA.put(key, buf, { httpMetadata: { contentType: ct } });
  return json({ ok: true, key, url: '/media/' + key });
}
