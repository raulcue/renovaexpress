# Renova Express — Google Reviews API

Worker de Cloudflare que proxea la **Google Places API** para mostrar reseñas reales de Google en la web sin exponer la clave de API en el cliente.

## Por qué un worker y no un fetch directo

La Google Places API exige clave de servidor. Si la pones en el frontend, cualquiera puede copiarla y gastarte la cuota. El worker:
- Guarda la clave como secreto en Cloudflare.
- Cachea la respuesta 12 h (no quemas cuota).
- Sirve solo a tu dominio (CORS controlado).
- Cuesta **0 €** dentro del plan gratuito (100 000 req/día).

## Despliegue paso a paso

> ⚠️ **Antes de nada: comprueba qué Places API tienes disponible.**
>
> `reviews-worker.js` llama al endpoint **clásico**
> (`maps.googleapis.com/maps/api/place/details/json`), que necesita la API
> llamada **"Places API"** a secas. La **"Places API (New)"** es un producto
> distinto, con otro endpoint y otro formato de respuesta.
>
> Google restringe la API clásica en proyectos nuevos. Si al probar el worker
> recibes `REQUEST_DENIED`, es esto: hay que reescribir `fetchPlace()` para
> `places.googleapis.com/v1/places/{place_id}` (POST, cabecera `X-Goog-Api-Key`
> y `X-Goog-FieldMask`). Verifícalo en el paso 5 (`wrangler dev`) antes de
> desplegar, porque condiciona todo lo demás.

### 1. Habilita la Places API en Google Cloud
1. Entra en https://console.cloud.google.com → crea o selecciona un proyecto.
2. Activa **Places API (New)** en *APIs & Services → Library*.
3. Crea una credencial → **API key**.
4. Restringe la clave, pero **con cuidado**:
   - **API restrictions** = solo Places API. ✅ Esto sí, siempre.
   - **Application restrictions** = **Ninguna**. ⚠️

   > ❌ **No pongas restricción por HTTP referrer.** Es un error fácil de cometer.
   > Las restricciones por referrer sirven para llaves que se usan **desde el
   > navegador**. Aquí quien llama a Google es el **worker**, desde el servidor:
   > no manda cabecera `Referer`, así que Google rechazaría todas las peticiones
   > con `REQUEST_DENIED` y las reseñas no cargarían nunca.
   >
   > Restringir por IP tampoco vale: los Workers salen por muchísimas IPs de
   > Cloudflare y no son fijas.
   >
   > La clave está protegida igualmente porque vive como **secreto cifrado en
   > Cloudflare**, nunca se expone al navegador. Para dormir tranquilo, ponle
   > además un **límite de cuota diario** en Google Cloud
   > (*APIs & Services → Quotas*): con caché de 12 h te sobra con 10 al día.

### 2. Encuentra los `place_id` de cada centro

Usa el [Place ID Finder](https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder) o busca tu negocio en Google Maps. El ID empieza por `ChIJ…`.

- Centro Gijón (Ctra. AS-II 1306) → `ChIJiQSuiat9Ng0Rb1mwDmcZcwg`
- Centro Oviedo (C/ General Elorza 75) → `ChIJcwg_jYqNNg0RVdkkBTnUWig`

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

> **Límite de Google:** la Places API devuelve **como máximo 5 reseñas por ficha**,
> no todas las que tengas. `rating` y `user_ratings_total` sí son reales y completos,
> así que la media y el contador son correctos; lo que se queda corto es el carrusel.
> Por eso el enlace "Ver todas las reseñas en Google" es importante.

### Reseñas por centro

Cada página elige qué centro muestra con una etiqueta en el `<head>`:

```html
<meta name="reviews-center" content="gijon">   <!-- o "oviedo" -->
```

Sin esa etiqueta se mezclan las de ambos centros. Configuración actual:

| Página | Centro |
|---|---|
| `index.html` | Gijón |
| `centros/gijon.html` | Gijón |
| `centros/oviedo.html` | Oviedo |

El filtrado es de cliente: el worker sigue devolviendo un único JSON con los dos
centros (una sola llamada, una sola caché) y `main.js` toma el que toque de `centers`.

## Coste estimado

- Google Places API: **0 $** mientras estés dentro de los 200 $ gratis/mes (la llamada *Place Details* cuesta ~0,017 $).
- Cloudflare Workers: **0 €** en plan free (100k req/día).
- Con cache 12 h: ~2 llamadas/día reales a Google. Incluso con miles de visitas estás bajo 1 $/mes.

## Alternativa sin código

Si prefieres no tocar nada y aceptas que aparezca el branding del proveedor:
- **Trustindex** (gratis, hasta 6 reseñas) — https://www.trustindex.io
- **Elfsight** (de pago desde 5 €/mes, ilimitado) — https://elfsight.com/google-reviews-widget/

En ambos casos pegas un `<script>` y se acabó. Pero la opción del worker te da control total y mejor SEO (el JSON-LD `Review` lo puedes generar tú).
