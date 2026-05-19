# Renova Express — Web corporativa

Sitio web estático multipágina para **Renova Express Psicotécnicos S.L.**, Centro de Reconocimiento de Conductores homologado por la DGT con dos centros en Asturias (Gijón · CC Alcampo, y Oviedo · CC Salesas).

- **Stack:** HTML5 semántico + CSS3 con variables + JavaScript ES2024 vanilla.
- **Sin build step:** todas las librerías se cargan desde CDN.
- **Mobile-first**, accesible (WCAG 2.1 AA), preparada para Lighthouse 95+.
- **Despliegue:** apto para Netlify, Vercel, Cloudflare Pages o Render con un simple `git push`.

---

## Estructura del proyecto

```
/
├── index.html                              ← Home
├── sobre-nosotros.html
├── precios.html
├── faq.html
├── contacto.html
├── cita-previa.html
├── sitemap.xml
├── robots.txt
├── CREDITS.md
├── README.md
│
├── servicios/
│   ├── carnet-de-conducir.html
│   ├── licencia-armas.html
│   ├── licencias-nauticas.html
│   ├── seguridad-privada.html
│   ├── animales-peligrosos.html
│   ├── operador-grua.html
│   ├── certificados-deportivos.html
│   └── certificados-oficiales.html
│
├── centros/
│   ├── gijon.html
│   └── oviedo.html
│
├── blog/
│   ├── index.html
│   ├── renovacion-carnet-asturias-2026.html
│   ├── cuanto-cuesta-psicotecnico.html
│   ├── licencia-armas-espana.html
│   ├── carnet-perros-ppp.html
│   └── canje-carnet-extranjero.html
│
├── legal/
│   ├── aviso-legal.html
│   ├── politica-privacidad.html
│   └── politica-cookies.html
│
└── assets/
    ├── css/main.css
    ├── js/main.js
    └── img/                ← coloca aquí logo + fotos reales del cliente
```

---

## Desarrollo local

No requiere build. Cualquier servidor estático funciona:

```bash
# Opción 1: Python
python3 -m http.server 8080

# Opción 2: Node
npx serve .

# Opción 3: VS Code Live Server (extensión)
```

Abre http://localhost:8080 en el navegador.

---

## Despliegue

### Netlify (recomendado)
1. Sube el repo a GitHub/GitLab.
2. Crea un sitio nuevo en Netlify desde el repo.
3. Build command: *(vacío)*.
4. Publish directory: `.`
5. Deploy.

### Vercel
```bash
npx vercel --prod
```

### Cloudflare Pages
- Build command: *(vacío)*
- Build output directory: `.`

### Render (el cliente ya lo usa)
- Crea un nuevo "Static Site".
- Build command: *(vacío)*
- Publish directory: `.`

---

## Checklist de migración para el cliente

Antes de publicar, sustituye o confirma todos los placeholders marcados como `[CONFIRMAR CON CLIENTE]` o `[CONFIRMAR]`:

### 🎨 Identidad visual
- [ ] Subir logotipo oficial a `assets/img/logo-renovaexpress.svg` (o .png) y reemplazar el placeholder `RE` en todos los headers/footers.
- [ ] Confirmar paleta de colores exacta en `assets/css/main.css` (variables `--re-primary`, `--re-accent`).
- [ ] Subir foto de portada Open Graph a `assets/img/og-cover.jpg` (1200×630 px).

### 📸 Fotografía
- [ ] Sustituir imágenes placeholder de Unsplash por fotografías reales del equipo, los locales y las salas de exploración.
- [ ] Actualizar `alt` y revisar `CREDITS.md`.

### 💶 Precios
- [ ] Cumplimentar todas las celdas marcadas `[CONFIRMAR] €` en `precios.html`.
- [ ] Actualizar las tasas DGT vigentes si decides incluirlas.

### 🗓️ Horarios
- [ ] Confirmar horarios reales de cada centro en `centros/gijon.html`, `centros/oviedo.html` y en el schema.org `OpeningHoursSpecification`.

### ⭐ Reseñas de Google (API)
La home **ya está cableada** para consumir un endpoint que devuelve las reseñas reales de Google Business Profile. Para activarlo:

1. Despliega el Cloudflare Worker incluido en [`api/reviews-worker.js`](api/reviews-worker.js).
2. Sigue las instrucciones detalladas en [`api/README.md`](api/README.md) (clave de Google Cloud, `place_id` de cada centro, `wrangler deploy`).
3. Sustituye en `index.html` el meta:
   ```html
   <meta name="reviews-endpoint" content="https://api.example.com/reviews">
   ```
   por la URL real del worker.

Si no llegas a desplegar el worker, los skeletons "Conectando con Google…" se ocultan automáticamente y la maquetación queda limpia.

**Alternativa sin código:** Trustindex (https://www.trustindex.io) o Elfsight (https://elfsight.com). Reemplaza el bloque `<div class="swiper swiper-testimonials">` por el snippet del widget.

### 📅 Cita previa
- [ ] Crear cuenta en Cal.com (https://cal.com) o Calendly (https://calendly.com).
- [ ] Embeber el calendario en `cita-previa.html` sustituyendo el bloque "Espacio reservado para el calendario".

### 📧 Formularios
- [ ] Crear cuenta en https://formspree.io o https://web3forms.com.
- [ ] Sustituir `https://formspree.io/f/[CONFIRMAR-ID]` en `contacto.html` y `cita-previa.html` por el endpoint real.

### 📞 WhatsApp
- [ ] Confirmar si el cliente usa WhatsApp Business en el número 985 059 067 o necesita un número diferente. Actualizar `<a class="wa-float">` en todas las páginas.

### 📊 Analítica
- [ ] (Opcional) Añadir Plausible/Google Analytics 4. Recuerda incluirla en la tabla de `legal/politica-cookies.html`.

### ⚖️ Legal
- [ ] Revisar y actualizar `legal/aviso-legal.html`, `legal/politica-privacidad.html` y `legal/politica-cookies.html` con la asesoría legal.
- [ ] Confirmar CIF, número de Registro Mercantil y DPO (si aplica).
- [ ] Mantener el texto base actual de https://renovaexpress.com/avisos-legales/ y enriquecerlo.

### 🔢 Contadores
- [ ] Confirmar cifra real de "+50.000 reconocimientos" en `index.html` o ajustarla.

### 🗺️ Mapas
- [ ] (Opcional) Mejorar los embeds de Google Maps por uno con marcador y zoom personalizado generado desde Google Maps → "Compartir → Incrustar mapa".

---

## Auditoría recomendada antes de publicar

```bash
# Validador HTML
https://validator.w3.org/

# Auditoría Lighthouse (Chrome DevTools)
F12 → Lighthouse → Generate report

# Schema.org
https://search.google.com/test/rich-results

# Accesibilidad
Instalar axe DevTools en Chrome

# Open Graph
https://developers.facebook.com/tools/debug/
```

Objetivos:
- Lighthouse Performance ≥ 95
- Lighthouse Accesibilidad = 100
- Lighthouse SEO = 100
- Validación HTML: 0 errores
- Rich Results: 0 errores en `MedicalBusiness`, `LocalBusiness`, `FAQPage`, `Service`, `BreadcrumbList`.

---

## Características destacadas

- **Sin cita previa** como propuesta principal.
- **Hero animado** con Typed.js y badges de confianza.
- **Calculadora de renovación** interactiva en la página del carnet.
- **8 páginas de servicio** con FAQ específica.
- **2 páginas de centro** con SEO local y schema.org.
- **Blog SEO** con 5 posts iniciales.
- **Modo claro/oscuro** con `prefers-color-scheme`.
- **Cookie banner granular** conforme RGPD.
- **WhatsApp flotante** con pulse animation.
- **Mobile-first** con menú off-canvas.
- **Animaciones premium** (GSAP, Lenis, AOS, Swiper, Vanilla-tilt, CountUp).
- **`prefers-reduced-motion` respetado** en todas las animaciones.

---

## Datos de contacto del proyecto

- **Cliente:** Renova Express Psicotécnicos S.L.
- **Email:** crcrenovaexpress@gmail.com
- **Teléfonos:** Gijón 985 059 067 · Oviedo 984 019 079
- **Web actual:** https://renovaexpress.com/
- **Facebook:** https://www.facebook.com/CentroRenovaExpress

---

## Créditos

Ver [CREDITS.md](CREDITS.md) para todos los créditos de librerías e imágenes utilizadas.
