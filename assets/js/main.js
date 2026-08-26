/* ==========================================================================
   Renova Express — script principal
   Librerías cargadas desde CDN en cada página:
   - GSAP + ScrollTrigger
   - Lenis (scroll suave)
   - AOS
   - Swiper
   - Typed.js
   - CountUp.js
   - Vanilla-tilt
   ========================================================================== */

(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Header sticky shadow ---------- */
  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- Mobile nav off-canvas ---------- */
  const navToggle = document.querySelector('.nav__toggle');
  const mobileNav = document.querySelector('.mobile-nav');
  const mobileBackdrop = document.querySelector('.mobile-nav__backdrop');
  const mobileClose = document.querySelector('.mobile-nav__close');

  const openMobile = () => {
    mobileNav?.classList.add('is-open');
    mobileBackdrop?.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  };
  const mainView = document.querySelector('[data-mobile-view="main"]');
  const servicesView = document.querySelector('[data-mobile-view="services"]');
  const showMain = () => { if (mainView) mainView.hidden = false; if (servicesView) servicesView.hidden = true; };
  const showServices = () => { if (mainView) mainView.hidden = true; if (servicesView) servicesView.hidden = false; };
  const closeMobile = () => {
    mobileNav?.classList.remove('is-open');
    mobileBackdrop?.classList.remove('is-open');
    document.body.style.overflow = '';
    showMain();
  };
  navToggle?.addEventListener('click', openMobile);
  mobileBackdrop?.addEventListener('click', closeMobile);
  mobileClose?.addEventListener('click', closeMobile);
  document.querySelectorAll('.mobile-nav__list a').forEach(a => a.addEventListener('click', closeMobile));
  document.querySelectorAll('[data-open-services]').forEach(b => b.addEventListener('click', showServices));
  document.querySelectorAll('[data-close-services]').forEach(b => b.addEventListener('click', showMain));

  /* ---------- Theme toggle (claro/oscuro) ---------- */
  const themeToggle = document.querySelector('[data-theme-toggle]');
  const root = document.documentElement;
  const storedTheme = localStorage.getItem('re-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = storedTheme || (prefersDark ? 'dark' : 'light');
  root.setAttribute('data-theme', initialTheme);
  themeToggle?.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('re-theme', next);
  });

  /* ---------- Lenis scroll suave ---------- */
  if (typeof Lenis !== 'undefined' && !reduceMotion) {
    const lenis = new Lenis({ duration: 1.05, smoothWheel: true });
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    if (typeof gsap !== 'undefined' && gsap.ticker) {
      lenis.on('scroll', () => { if (window.ScrollTrigger) window.ScrollTrigger.update(); });
    }
  }

  /* ---------- AOS ---------- */
  if (typeof AOS !== 'undefined') {
    AOS.init({ once: true, duration: 700, easing: 'ease-out-cubic', disable: reduceMotion });
  }

  /* ---------- Typed.js en hero ---------- */
  const typedEl = document.querySelector('[data-typed]');
  if (typedEl && typeof Typed !== 'undefined' && !reduceMotion) {
    new Typed(typedEl, {
      strings: typedEl.dataset.typed.split('|'),
      typeSpeed: 70,
      backSpeed: 35,
      backDelay: 1700,
      loop: true,
      smartBackspace: true,
    });
  }

  /* ---------- CountUp en contadores ---------- */
  const counters = document.querySelectorAll('[data-countup]');
  if (counters.length && typeof countUp !== 'undefined') {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const target = parseFloat(e.target.dataset.countup);
          const opts = {
            duration: 2,
            separator: '.',
            suffix: e.target.dataset.suffix || '',
            prefix: e.target.dataset.prefix || '',
          };
          const c = new countUp.CountUp(e.target, target, opts);
          if (!c.error) c.start();
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.4 });
    counters.forEach(c => obs.observe(c));
  }

  /* ---------- Swiper testimonios ---------- */
  let testimonialsSwiper = null;
  function initTestimonialsSwiper() {
    if (typeof Swiper === 'undefined' || !document.querySelector('.swiper-testimonials')) return;
    if (testimonialsSwiper) testimonialsSwiper.destroy(true, true);
    testimonialsSwiper = new Swiper('.swiper-testimonials', {
      slidesPerView: 1,
      spaceBetween: 24,
      autoplay: reduceMotion ? false : { delay: 5500, disableOnInteraction: false },
      pagination: { el: '.swiper-pagination', clickable: true },
      breakpoints: { 640: { slidesPerView: 2 }, 1024: { slidesPerView: 3 } }
    });
  }
  initTestimonialsSwiper();

  /* ---------- Google Reviews (via worker endpoint) ----------
     Configure el endpoint en <meta name="reviews-endpoint" content="https://…">
     El endpoint debe devolver JSON con la forma:
       { rating: 4.9, total: 312, reviews: [
           { author_name, rating, text, relative_time_description, profile_photo_url, center }
       ] }
  */
  async function loadGoogleReviews() {
    const meta = document.querySelector('meta[name="reviews-endpoint"]');
    const endpoint = meta?.content?.trim();
    const wrap = document.querySelector('[data-google-reviews]');
    if (!wrap) return;
    if (!endpoint || endpoint.startsWith('https://api.example')) {
      console.info('[Renova Express] Endpoint de reseñas no configurado. Sigue api/README.md para conectarlo a Google.');
      wrap.querySelectorAll('.testimonial.is-loading').forEach(el => el.classList.remove('is-loading'));
      return;
    }

    try {
      const res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!Array.isArray(data.reviews) || !data.reviews.length) throw new Error('sin reseñas');
      renderReviews(wrap, data);
    } catch (err) {
      console.warn('[Renova Express] Reseñas Google no disponibles:', err.message);
      wrap.querySelectorAll('.testimonial.is-loading').forEach(el => el.classList.remove('is-loading'));
    }
  }

  function renderReviews(wrap, data) {
    const aggregate = document.querySelector('[data-google-aggregate]');
    if (aggregate && typeof data.rating === 'number') {
      const stars = '★'.repeat(Math.round(data.rating)) + '☆'.repeat(5 - Math.round(data.rating));
      aggregate.querySelector('.reviews-header__stars').textContent = stars;
      aggregate.querySelector('.reviews-header__rating').textContent = data.rating.toFixed(1);
      aggregate.querySelector('.reviews-header__count').textContent =
        (data.total || data.reviews.length) + ' reseñas en Google';
      aggregate.hidden = false;
    }

    const html = data.reviews.slice(0, 8).map(r => slideHTML(r)).join('');
    wrap.querySelector('.swiper-wrapper').innerHTML = html;
    initTestimonialsSwiper();
  }

  function escapeHTML(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function slideHTML(r) {
    const rating = Math.max(1, Math.min(5, Number(r.rating) || 5));
    const stars = '<i class="fa-solid fa-star"></i>'.repeat(rating) +
                  '<i class="fa-regular fa-star"></i>'.repeat(5 - rating);
    const name = escapeHTML(r.author_name || 'Cliente');
    const initial = (name[0] || 'C').toUpperCase();
    const text = escapeHTML(r.text || '');
    const time = escapeHTML(r.relative_time_description || '');
    const center = escapeHTML(r.center || '');
    const avatar = r.profile_photo_url
      ? `<img src="${escapeHTML(r.profile_photo_url)}" alt="" loading="lazy" style="width:42px;height:42px;border-radius:50%;object-fit:cover">`
      : `<div class="testimonial__avatar">${escapeHTML(initial)}</div>`;
    return `
      <div class="swiper-slide">
        <article class="testimonial">
          <div class="testimonial__stars" aria-label="${rating} estrellas">${stars}</div>
          <p class="testimonial__text">${text}</p>
          <div class="testimonial__author">
            ${avatar}
            <div>
              <div class="testimonial__name">${name}</div>
              <div class="testimonial__meta">${center ? center + ' · ' : ''}${time}</div>
              <div class="testimonial__badge"><i class="fa-brands fa-google"></i> Reseña verificada en Google</div>
            </div>
          </div>
        </article>
      </div>`;
  }

  loadGoogleReviews();

  /* ---------- Vanilla-tilt en service cards ---------- */
  if (typeof VanillaTilt !== 'undefined' && !reduceMotion) {
    const tiltEls = document.querySelectorAll('[data-tilt]');
    if (tiltEls.length) {
      VanillaTilt.init(tiltEls, { max: 6, speed: 600, glare: true, 'max-glare': 0.12, scale: 1.02 });
    }
  }

  /* ---------- Cookie banner ---------- */
  const cookieBanner = document.querySelector('.cookie-banner');
  if (cookieBanner) {
    const accepted = localStorage.getItem('re-cookies');
    if (!accepted) setTimeout(() => cookieBanner.classList.add('is-visible'), 1200);
    document.querySelectorAll('[data-cookie-accept]').forEach(b => b.addEventListener('click', () => {
      const opts = { necessary: true, analytics: !!document.querySelector('#ck-analytics')?.checked, marketing: !!document.querySelector('#ck-marketing')?.checked };
      localStorage.setItem('re-cookies', JSON.stringify(opts));
      cookieBanner.classList.remove('is-visible');
    }));
    document.querySelector('[data-cookie-reject]')?.addEventListener('click', () => {
      localStorage.setItem('re-cookies', JSON.stringify({ necessary: true, analytics: false, marketing: false }));
      cookieBanner.classList.remove('is-visible');
    });
  }

  /* ---------- Calculadora de renovación ---------- */
  const renewForm = document.querySelector('[data-renew-form]');
  if (renewForm) {
    renewForm.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const fecha = renewForm.querySelector('#renew-date').value;
      const edad = parseInt(renewForm.querySelector('#renew-age').value, 10);
      const tipo = renewForm.querySelector('#renew-type').value;
      const out = renewForm.querySelector('[data-renew-result]');
      if (!fecha || !edad || !tipo) { out.textContent = 'Por favor, completa todos los campos.'; return; }
      const fc = new Date(fecha);
      const today = new Date();
      const diasParaCaducar = Math.ceil((fc - today) / (1000*60*60*24));
      let vigencia = 10;
      if (tipo === 'B' || tipo === 'AM' || tipo === 'A1' || tipo === 'A2' || tipo === 'A') {
        vigencia = edad >= 65 ? 5 : 10;
      } else {
        vigencia = edad >= 65 ? 3 : 5;
      }
      const puedesDesde = new Date(fc); puedesDesde.setMonth(puedesDesde.getMonth() - 3);
      const diasParaPoder = Math.ceil((puedesDesde - today) / (1000*60*60*24));
      let msg = '';
      if (diasParaCaducar < 0) {
        msg = `Tu carnet caducó hace ${Math.abs(diasParaCaducar)} días. Ven cuanto antes — sigues pudiendo renovarlo.`;
      } else if (diasParaPoder <= 0) {
        msg = `Ya puedes renovar tu carnet. Caduca en ${diasParaCaducar} días. Próxima vigencia: ${vigencia} años.`;
      } else {
        msg = `Aún no puedes renovar. Podrás hacerlo desde el ${puedesDesde.toLocaleDateString('es-ES')} (${diasParaPoder} días). Vigencia: ${vigencia} años.`;
      }
      out.textContent = msg;
      out.classList.add('is-visible');
    });
  }

  /* ---------- Formulario de contacto anti-bot ----------
     Capas de protección (sin captcha visible, sin perjudicar UX legítimo):
       1. Honeypot: campo oculto `website`; si llega relleno → bot
       2. Timestamp: form must take > 3s entre carga y submit
       3. Campos invisibles JS (viewport/lang/url) que solo un browser real rellena
       4. Token JS-required (vx_token) generado al cargar; bots sin JS no lo tienen
       5. (Opcional) Cloudflare Turnstile / hCaptcha — basta con cargar el script y dejar el data-sitekey
  */
  document.querySelectorAll('form[data-protected-form]').forEach(form => {
    const loadedAt = Date.now();
    // Inyecta token JS-only
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const tokenInput = document.createElement('input');
    tokenInput.type = 'hidden';
    tokenInput.name = 'vx_token';
    tokenInput.value = token;
    form.appendChild(tokenInput);

    // Campos viewport (replica el truco de renovaexpress.com)
    [
      ['vx_width',  String(window.innerWidth)],
      ['vx_height', String(window.innerHeight)],
      ['vx_lang',   navigator.language || ''],
      ['vx_url',    window.location.href],
      ['vx_loaded_at', String(loadedAt)],
    ].forEach(([n, v]) => {
      const i = document.createElement('input');
      i.type = 'hidden'; i.name = n; i.value = v;
      form.appendChild(i);
    });

    const status = form.querySelector('.form__status');
    const submitBtn = form.querySelector('button[type=submit], input[type=submit]');

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }

      // Capa 1: honeypot
      const hp = form.querySelector('input[name="website"]');
      if (hp && hp.value.trim() !== '') {
        showStatus(status, 'err', 'No se pudo enviar. Inténtalo de nuevo más tarde.');
        return;
      }
      // Capa 2: timestamp mínimo
      const elapsed = Date.now() - loadedAt;
      if (elapsed < 3000) {
        showStatus(status, 'err', 'El formulario se envió demasiado rápido. Espera un momento e inténtalo de nuevo.');
        return;
      }

      submitBtn?.setAttribute('disabled', 'disabled');
      submitBtn?.classList.add('is-loading');
      showStatus(status, 'info', 'Enviando…');

      try {
        const action = form.getAttribute('action');
        const fd = new FormData(form);
        const res = await fetch(action, { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        showStatus(status, 'ok', '¡Gracias! Hemos recibido tu mensaje y te responderemos en breve.');
        form.reset();
      } catch (err) {
        console.warn('[Renova Express] Form submit failed:', err.message);
        showStatus(status, 'err', 'No se pudo enviar el formulario. Llámanos al 985 059 067 o escribe a crcrenovaexpress@gmail.com.');
      } finally {
        submitBtn?.removeAttribute('disabled');
        submitBtn?.classList.remove('is-loading');
      }
    });
  });

  function showStatus(el, kind, msg) {
    if (!el) return;
    el.className = 'form__status form__status--' + kind + ' is-visible';
    el.textContent = msg;
  }

  /* ---------- Año en footer ---------- */
  const yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Scroll progress bar ---------- */
  const progressBar = document.querySelector('.scroll-progress__bar');
  if (progressBar) {
    const updateProgress = () => {
      const h = document.documentElement;
      const scrolled = h.scrollTop / (h.scrollHeight - h.clientHeight);
      progressBar.style.width = (scrolled * 100).toFixed(2) + '%';
    };
    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
  }

  /* ---------- Marquee: duplicar contenido para loop perfecto ---------- */
  document.querySelectorAll('.marquee__track').forEach(track => {
    if (track.dataset.duplicated) return;
    track.dataset.duplicated = '1';
    track.innerHTML += track.innerHTML;
  });

  /* ---------- Botones magnéticos ---------- */
  if (!reduceMotion) {
    const magnetStrength = 18;
    document.querySelectorAll('[data-magnetic], .magnetic').forEach(el => {
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        const dx = (x / rect.width)  * magnetStrength;
        const dy = (y / rect.height) * magnetStrength;
        el.style.transform = `translate(${dx}px, ${dy}px)`;
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = '';
      });
    });
  }

  /* ---------- Reveals + parallax + section heads con GSAP ---------- */
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined' && !reduceMotion) {
    gsap.registerPlugin(ScrollTrigger);

    // Fade-up genérico
    gsap.utils.toArray('[data-gsap-fade], [data-gsap-up]').forEach((el) => {
      gsap.to(el, {
        opacity: 1, y: 0, duration: .9, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%' }
      });
    });

    // Stagger reveal en grupos
    gsap.utils.toArray('[data-gsap-stagger]').forEach((group) => {
      gsap.to(group.children, {
        opacity: 1, y: 0, duration: .7, ease: 'power3.out',
        stagger: .12,
        scrollTrigger: { trigger: group, start: 'top 85%' }
      });
    });

    // Marcar section heads cuando se revelan (para underline)
    gsap.utils.toArray('.section__head').forEach((head) => {
      ScrollTrigger.create({
        trigger: head, start: 'top 80%',
        onEnter: () => head.classList.add('is-revealed'),
      });
    });

    // Parallax sutil en el fondo del hero
    const heroBg = document.querySelector('.hero__bg');
    if (heroBg) {
      gsap.to(heroBg, {
        yPercent: 18,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero',
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        }
      });
    }

    // Hero entrance timeline (texto + CTAs + badges secuenciados)
    const heroContent = document.querySelector('.hero__grid > div:first-child');
    if (heroContent) {
      const tl = gsap.timeline({ delay: .15 });
      tl.from('.hero__eyebrow', { opacity: 0, y: 20, duration: .6, ease: 'power2.out' })
        .from('.hero h1',        { opacity: 0, y: 30, duration: .8, ease: 'power3.out' }, '-=.3')
        .from('.hero__lead',     { opacity: 0, y: 20, duration: .6, ease: 'power2.out' }, '-=.4')
        .from('.hero__ctas .btn',{ opacity: 0, y: 16, duration: .5, ease: 'power2.out', stagger: .1 }, '-=.3')
        .from('.hero__badge',    { opacity: 0, y: 14, duration: .45, ease: 'power2.out', stagger: .08 }, '-=.2')
        .from('.hero__minicard', { opacity: 0, x: 30, duration: .55, ease: 'power3.out', stagger: .12 }, '-=.5');
    }

  }

})();
