# Renova Express — Google Reviews API

Worker de Cloudflare que proxea la **Google Places API** para mostrar reseñas reales de Google en la web sin exponer la clave de API en el cliente.

## Por qué un worker y no un fetch directo

La Google Places API exige clave de servidor. Si la pones en el frontend, cualquiera puede copiarla y gastarte la cuota. El worker:
- Guarda la clave como secreto en Cloudflare.
- Cachea la respuesta 12 h (no quemas cuota).
- Sirve solo a tu dominio (CORS controlado).
- Cuesta **0 €** dentro del plan gratuito (100 000 req/día).

## Despliegue paso a paso

### 1. Habilita la Places API en Google Cloud
1. Entra en https://console.cloud.google.com → crea o selecciona un proyecto.
2. Activa **Places API (New)** en *APIs & Services → Library*.
3. Crea una credencial → **API key**.
4. (Recomendado) Restringe la clave por:
   - **HTTP referrers** = `*.workers.dev` y/o tu subdominio del worker.
   - **API restrictions** = solo Places API.

### 2. Encuentra los `place_id` de cada centro

Usa el [Place ID Finder](https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder) o busca tu negocio en Google Maps. El ID empieza por `ChIJ…`.

- Centro Gijón (Ctra. AS-II 1306) → `[CONFIRMAR]`
- Centro Oviedo (C/ General Elorza 75) → `[CONFIRMAR]`

### 3. Despliega el worker

```bash
npm install -g wrangler
wrangler login

# Crea el proyecto
wrangler init renova-reviews --type "javascript" --yes
cd renova-reviews

# Copia reviews-worker.js → src/index.js (o ajusta `main` en wrangler.toml)
cp ../reviews-worker.js src/index.js
cp ../wrangler.toml .

# Configura los secretos
wrangler secret put GOOGLE_API_KEY
wrangler secret put PLACE_ID_GIJON
wrangler secret put PLACE_ID_OVIEDO

# Despliega
wrangler deploy
```

Wrangler te devolverá la URL del worker, por ejemplo:
```
https://renova-reviews.tuusuario.workers.dev
```

### 4. Conecta el frontend

En `index.html` localiza la etiqueta:

```html
<meta name="reviews-endpoint" content="https://api.example.com/reviews">
```

y sustituye la URL por la del worker:

```html
<meta name="reviews-endpoint" content="https://renova-reviews.tuusuario.workers.dev">
```

Recarga la home: las reseñas se cargan dinámicamente desde Google. Si la API falla, los slides skeleton se ocultan y no rompe la maquetación.

### 5. Probar localmente

```bash
wrangler dev
curl http://localhost:8787
```

Deberías recibir un JSON con `rating`, `total`, `centers` y `reviews[]`.

## Formato del JSON devuelto

```json
{
  "rating": 4.9,
  "total": 312,
  "centers": {
    "gijon":  { "name": "...", "rating": 4.9, "user_ratings_total": 200, "reviews": [...] },
    "oviedo": { "name": "...", "rating": 4.8, "user_ratings_total": 112, "reviews": [...] }
  },
  "reviews": [
    {
      "author_name": "María García",
      "rating": 5,
      "text": "Rápido y profesional...",
      "relative_time_description": "hace 2 semanas",
      "time": 1740000000,
      "profile_photo_url": "https://...",
      "center": "Centro Gijón"
    }
  ],
  "cached_at": "2026-05-18T18:30:00.000Z"
}
```

El frontend filtra y ordena automáticamente; el worker ya filtra las reseñas de 4-5 estrellas y las ordena de más reciente a más antigua.

## Coste estimado

- Google Places API: **0 $** mientras estés dentro de los 200 $ gratis/mes (la llamada *Place Details* cuesta ~0,017 $).
- Cloudflare Workers: **0 €** en plan free (100k req/día).
- Con cache 12 h: ~2 llamadas/día reales a Google. Incluso con miles de visitas estás bajo 1 $/mes.

## Alternativa sin código

Si prefieres no tocar nada y aceptas que aparezca el branding del proveedor:
- **Trustindex** (gratis, hasta 6 reseñas) — https://www.trustindex.io
- **Elfsight** (de pago desde 5 €/mes, ilimitado) — https://elfsight.com/google-reviews-widget/

En ambos casos pegas un `<script>` y se acabó. Pero la opción del worker te da control total y mejor SEO (el JSON-LD `Review` lo puedes generar tú).
