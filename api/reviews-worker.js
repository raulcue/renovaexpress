/**
 * Cloudflare Worker — Renova Express · Google Reviews proxy
 * ----------------------------------------------------------
 * Consume la Google Places API (Place Details) para los dos centros,
 * agrega reseñas, calcula valoración media y devuelve un JSON
 * cacheado consumible por el frontend.
 *
 * Despliegue rápido:
 *   1. Crea una cuenta en https://workers.cloudflare.com
 *   2. `npm i -g wrangler && wrangler login`
 *   3. `wrangler init renova-reviews --type "javascript"` y sustituye
 *      `src/index.js` por este archivo.
 *   4. Configura los secretos:
 *        wrangler secret put GOOGLE_API_KEY
 *        wrangler secret put PLACE_ID_GIJON
 *        wrangler secret put PLACE_ID_OVIEDO
 *   5. `wrangler deploy`
 *   6. Toma la URL resultante (ej. https://renova-reviews.tuusuario.workers.dev)
 *      y actualiza en index.html:
 *        <meta name="reviews-endpoint" content="https://renova-reviews.tuusuario.workers.dev">
 *
 * Variables/secretos esperados:
 *   GOOGLE_API_KEY   → tu clave de Google Cloud con la Places API habilitada
 *   PLACE_ID_GIJON   → place_id de la ficha Google Business de Gijón
 *   PLACE_ID_OVIEDO  → place_id de la ficha Google Business de Oviedo
 *   ALLOWED_ORIGINS  → (opcional) coma-separados, p.ej. "https://renovaexpress.com"
 *
 * Coste y caché: la respuesta se cachea 12 h en el edge de Cloudflare
 * para no quemar la cuota gratuita de Google (200 $/mes ~ ~5000 detalles).
 */

const PLACES_API = 'https://maps.googleapis.com/maps/api/place/details/json';
const FIELDS = 'reviews,rating,user_ratings_total,name';
const CACHE_SECONDS = 60 * 60 * 12; // 12 horas

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return preflight(request, env);
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });

    const cacheKey = new Request(request.url, request);
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) return withCors(cached, request, env);

    try {
      const [g, o] = await Promise.all([
        fetchPlace(env.GOOGLE_API_KEY, env.PLACE_ID_GIJON, 'Centro Gijón'),
        fetchPlace(env.GOOGLE_API_KEY, env.PLACE_ID_OVIEDO, 'Centro Oviedo'),
      ]);

      const allReviews = [...(g.reviews || []), ...(o.reviews || [])]
        // Solo 4 y 5 estrellas, ordenadas por más recientes
        .filter(r => (r.rating || 0) >= 4)
        .sort((a, b) => (b.time || 0) - (a.time || 0));

      // Valoración agregada ponderada por número de reseñas
      const totalReviews = (g.user_ratings_total || 0) + (o.user_ratings_total || 0);
      const weighted = (
        (g.rating || 0) * (g.user_ratings_total || 0) +
        (o.rating || 0) * (o.user_ratings_total || 0)
      ) / (totalReviews || 1);

      const body = JSON.stringify({
        rating: Math.round(weighted * 10) / 10,
        total: totalReviews,
        centers: { gijon: g, oviedo: o },
        reviews: allReviews,
        cached_at: new Date().toISOString(),
      });

      const response = new Response(body, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
        },
      });

      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return withCors(response, request, env);
    } catch (err) {
      return withCors(
        new Response(JSON.stringify({ error: err.message }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        }),
        request,
        env
      );
    }
  },
};

async function fetchPlace(apiKey, placeId, centerLabel) {
  if (!apiKey || !placeId) throw new Error('Missing GOOGLE_API_KEY or PLACE_ID');
  const url = `${PLACES_API}?place_id=${encodeURIComponent(placeId)}&fields=${FIELDS}&language=es&reviews_sort=newest&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Places API HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== 'OK') throw new Error(`Places API ${data.status}: ${data.error_message || ''}`);

  const reviews = (data.result.reviews || []).map(r => ({
    author_name: r.author_name,
    rating: r.rating,
    text: r.text,
    relative_time_description: r.relative_time_description,
    time: r.time,
    profile_photo_url: r.profile_photo_url,
    center: centerLabel,
  }));

  return {
    name: data.result.name,
    rating: data.result.rating,
    user_ratings_total: data.result.user_ratings_total,
    reviews,
  };
}

function withCors(response, request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '*')
    .split(',')
    .map(s => s.trim());
  const allowOrigin = allowed.includes('*') || allowed.includes(origin) ? origin || '*' : allowed[0];

  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', allowOrigin);
  headers.set('Vary', 'Origin');
  return new Response(response.body, { status: response.status, headers });
}

function preflight(request, env) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  });
}
