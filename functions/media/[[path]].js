/* GET /media/<key> — serve an uploaded image from R2 (public, cached).
   Used by event flyers and any future uploaded media. */
export async function onRequestGet({ params, env }) {
  if (!env.MEDIA) return new Response('Not found', { status: 404 });
  const key = Array.isArray(params.path) ? params.path.join('/') : String(params.path || '');
  if (!key) return new Response('Not found', { status: 404 });
  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  if (obj.httpEtag) headers.set('etag', obj.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(obj.body, { headers });
}
