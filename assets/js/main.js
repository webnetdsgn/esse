/* ESSE — scroll choreography. No dependencies.
   Everything animates through transform / opacity / clip-path and CSS custom properties.
   prefers-reduced-motion: the <html> element gets .rm (set in <head>) and every scrubbed effect falls back to a static state. */
(() => {
  'use strict';
  const D = document, R = D.documentElement;
  const rm = R.classList.contains('rm');
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, c = D) => c.querySelector(s);
  const $$ = (s, c = D) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  R.classList.add('ready');
  let vw = innerWidth, vh = innerHeight, y = scrollY, ys = y;

  /* ───────── header + menu ───────── */
  const header = $('[data-header]');
  const burger = $('[data-burger]');
  const menu = $('[data-menu]');
  let menuOpen = false, lastY = y;

  function setMenu(open) {
    if (!menu || open === menuOpen) return;
    menuOpen = open;
    burger.setAttribute('aria-expanded', String(open));
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
      D.body.classList.add('menu-open');
      header.classList.remove('is-hidden');
    } else {
      menu.classList.remove('is-open');
      D.body.classList.remove('menu-open');
      setTimeout(() => { if (!menuOpen) menu.hidden = true; }, 850);
    }
  }
  if (burger) {
    burger.addEventListener('click', () => setMenu(!menuOpen));
    addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
    $$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));
    matchMedia('(min-width: 901px)').addEventListener('change', e => { if (e.matches) setMenu(false); });
  }
  function headerUpdate() {
    if (!header) return;
    header.classList.toggle('is-solid', y > 40);
    const dy = y - lastY;
    if (!menuOpen) {
      if (y > vh * .9 && dy > 6) header.classList.add('is-hidden');
      else if (dy < -6 || y < vh * .9) header.classList.remove('is-hidden');
    }
    lastY = y;
  }

  /* ───────── text splitting ───────── */
  function splitLines(el) {
    if (!el.dataset.src) el.dataset.src = el.textContent.trim().replace(/\s+/g, ' ');
    const words = el.dataset.src.split(' ');       // plain spaces only — nbsp keeps short words glued
    el.innerHTML = words.map(w => `<span class="wd">${w}</span>`).join(' ');
    const lines = []; let last = null;
    $$('.wd', el).forEach(s => {
      const t = s.offsetTop;
      if (last === null || Math.abs(t - last) > 4) { lines.push([]); last = t; }
      lines[lines.length - 1].push(s.textContent);
    });
    el.innerHTML = lines.map((l, i) => `<span class="ln"><span class="ln__in" style="--li:${i}">${l.join(' ')}</span></span>`).join('');
  }
  function splitWords(el) {
    const words = el.textContent.trim().split(' ');
    el.innerHTML = words.map((w, i) => `<span class="w" style="--i:${i}">${w}</span>`).join(' ');
    el.style.setProperty('--n', words.length);
  }

  /* ───────── reveal / counters ───────── */
  let revealIO;
  function count(el) {
    const to = +el.dataset.count, t0 = performance.now(), d = 1700;
    el.textContent = '0';
    (function step(t) {
      const k = clamp((t - t0) / d);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  function onIn(el) { $$('[data-count]', el).forEach(count); }

  function initReveal() {
    if (rm) return;
    // clipped (wipe) figures are observed through their parent: an element clipped to nothing never "intersects"
    const hosts = new Map();
    revealIO = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const t = e.target;
      revealIO.unobserve(t);
      [t, ...(hosts.get(t) || [])].forEach(el => { el.classList.add('is-in'); onIn(el); });
    }), { threshold: .12, rootMargin: '0px 0px -6% 0px' });
    $$('[data-count]').forEach(el => { el.textContent = '0'; });
    $$('[data-reveal],[data-lines]').forEach(el => revealIO.observe(el));
    $$('[data-wipe]').forEach(fig => {
      const h = fig.parentElement;
      if (!hosts.has(h)) { hosts.set(h, []); revealIO.observe(h); }
      hosts.get(h).push(fig);
    });
  }

  /* ───────── scroll engine ───────── */
  const scrubs = [];
  const sio = new IntersectionObserver(es => es.forEach(e => { e.target._s.vis = e.isIntersecting; if (e.isIntersecting) schedule(); }),
    { rootMargin: '25% 0px 25% 0px' });
  function addScrub(el, fn) {
    if (!el) return;
    const s = { el, fn, vis: false };
    el._s = s; scrubs.push(s); sio.observe(el);
  }
  const rail = $('[data-rail]');
  let ticking = false;
  function schedule() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  function frame() {
    ticking = false;
    ys = rm ? y : lerp(ys, y, .2);
    const moving = Math.abs(y - ys) > .4;
    if (!moving) ys = y;
    for (const s of scrubs) if (s.vis) s.fn(y, ys);
    headerUpdate();
    if (rail) rail.style.setProperty('--sp', clamp(y / Math.max(1, R.scrollHeight - vh)).toFixed(4));
    if (moving || pointerBusy()) schedule();
  }
  addEventListener('scroll', () => { y = scrollY; schedule(); }, { passive: true });
  let rzT;
  addEventListener('resize', () => {
    const wChanged = innerWidth !== vw;
    vw = innerWidth; vh = innerHeight;
    clearTimeout(rzT);
    rzT = setTimeout(() => { if (wChanged) { resplit(); } schedule(); }, 180);
  });

  /* ───────── hero ───────── */
  const hero = $('[data-hero]');
  const heroEl = hero && $('.hero', hero);
  let mx = 0, my = 0, tmx = 0, tmy = 0;
  if (hero && !rm) {
    addScrub(hero, (yy, yss) => {
      const p = clamp(yss / Math.max(1, hero.offsetHeight - vh));
      heroEl.style.setProperty('--hp', p.toFixed(4));
      heroEl.style.setProperty('--mx', mx.toFixed(3));
      heroEl.style.setProperty('--my', my.toFixed(3));
    });
    if (fine) {
      addEventListener('pointermove', e => {
        tmx = (e.clientX / vw - .5) * 2; tmy = (e.clientY / vh - .5) * 2; schedule();
      }, { passive: true });
    }
  }

  /* ───────── manifest words ───────── */
  const mt = $('[data-words]');
  if (mt) {
    splitWords(mt);
    if (!rm) addScrub(mt, () => {
      const r = mt.getBoundingClientRect();
      mt.style.setProperty('--p', clamp((vh * .9 - r.top) / (r.height + vh * .45)).toFixed(4));
    });
  }

  /* ───────── helpers for sticky tracks ───────── */
  function trackProgress(track) {
    const r = track.getBoundingClientRect();
    return clamp(-r.top / Math.max(1, r.height - vh));
  }
  function trackTop(track) { return track.getBoundingClientRect().top + scrollY; }
  const goto = top => scrollTo({ top, behavior: rm ? 'auto' : 'smooth' });

  /* ───────── species ───────── */
  const spSec = $('[data-species]');
  if (spSec) {
    const track = $('.species__track', spSec);
    const items = $$('.sp', spSec), planks = $$('[data-splank]', spSec), dots = $$('.dot', spSec);
    const n = items.length;
    let active = -1;
    const setActive = i => {
      if (i === active) return;
      active = i;
      spSec.dataset.active = i;
      items.forEach((el, k) => el.classList.toggle('is-active', k === i));
      dots.forEach((el, k) => { el.classList.toggle('is-active', k === i); el.setAttribute('aria-current', k === i ? 'true' : 'false'); });
    };
    const go = i => goto(trackTop(track) + ((i + .38) / n) * (track.offsetHeight - vh));
    dots.forEach((d, i) => d.addEventListener('click', () => go(i)));
    $$('[data-sp-link]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); go(+a.dataset.spLink); }));
    if (rm) { setActive(0); items.forEach(el => el.classList.add('is-active')); }
    else {
      addScrub(track, () => {
        const p = trackProgress(track), seg = p * n, idx = Math.min(n - 1, Math.floor(seg)), t = seg - idx;
        const f = idx + (idx < n - 1 ? ss(.72, 1, t) : 0);
        planks.forEach((pl, i) => {
          const o = i - f;
          pl.style.setProperty('--o', o.toFixed(3));
          pl.style.setProperty('--ao', Math.min(1, Math.abs(o)).toFixed(3));
        });
        setActive(Math.round(f));
      });
    }
  }

  /* ───────── construction ───────── */
  const bSec = $('[data-build]');
  if (bSec) {
    const track = $('.build__track', bSec), scene = $('.scene', bSec), lis = $$('.layers-list li', bSec);
    if (!rm) addScrub(track, () => {
      const p = trackProgress(track);
      scene.style.setProperty('--e', ss(.04, .46, p).toFixed(4));
      const step = p < .4 ? -1 : Math.min(2, Math.floor(clamp((p - .4) / .58) * 3));
      if (bSec.dataset.step !== String(step)) {
        bSec.dataset.step = step;
        lis.forEach((li, i) => li.classList.toggle('is-active', i === step));
      }
    });
  }

  /* ───────── laying patterns ───────── */
  const pSec = $('[data-pat]');
  if (pSec) initPatterns(pSec);

  function initPatterns(sec) {
    const track = $('.pat__track', sec), g = $('[data-pat-pieces]', sec), cap = $('[data-pat-cap]', sec);
    const btns = $$('[data-p]', sec);
    const NAMES = btns.map(b => b.textContent.replace(/^\d+/, '').trim());
    const rnd = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const rect = (x, y0, w, h) => [[x, y0], [x + w, y0], [x + w, y0 + h], [x, y0 + h]];
    const hex = (cx, cy, r, a0 = 30) => Array.from({ length: 6 }, (_, k) => { const a = (a0 + 60 * k) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
    const tint = (base, k) => `rgb(${base.map(c => Math.round(clamp(c * k, 0, 255))).join(',')})`;
    const OAK = [201, 164, 110], WAL = [98, 68, 50], ASH = [228, 211, 174];

    const gens = [
      /* English herringbone: rectangular ends, staircase joint */
      r => { const w = 5.4, n = 4, out = [];
        for (let a = -26; a <= 26; a++) for (let b = -9; b <= 9; b++) {
          const x = a * w + b * (n + 1) * w + 50, yy = a * w + b * (1 - n) * w + 50;
          [[rect(x, yy, n * w, w), 'h'], [rect(x + n * w, yy - (n - 1) * w, w, n * w), 'v']].forEach(([pts, o]) => {
            const cx = pts[0][0] + (pts[2][0] - pts[0][0]) / 2, cy = pts[0][1] + (pts[2][1] - pts[0][1]) / 2;
            if (Math.hypot(cx - 50, cy - 50) < 76) out.push({ pts, o, fill: tint(OAK, .9 + r() * .2) });
          });
        }
        return { rot: 45, out }; },
      /* French herringbone: 45° mitred ends, straight joint */
      r => { const w = 5, n = 4, out = [];
        for (let s = -9; s <= 9; s++) for (let t = -32; t <= 32; t++) {
          let pts, o;
          if (((s % 2) + 2) % 2 === 0) { const X = (t + s * n) * w + 50, Y = t * w + 50; pts = [[X, Y], [X + n * w, Y], [X + (n + 1) * w, Y + w], [X + w, Y + w]]; o = 'h'; }
          else { const a = t; pts = [[a * w + 50, (a - s * n) * w + 50], [(a + 1) * w + 50, (a + 1 - s * n) * w + 50], [(a + 1) * w + 50, (a + 1 - (s + 1) * n) * w + 50], [a * w + 50, (a - (s + 1) * n) * w + 50]]; o = 'v'; }
          const cx = pts.reduce((m, p) => m + p[0], 0) / 4, cy = pts.reduce((m, p) => m + p[1], 0) / 4;
          if (Math.hypot(cx - 50, cy - 50) < 76) out.push({ pts, o, fill: tint(WAL, .88 + r() * .26) });
        }
        return { rot: 45, out }; },
      /* squares: cells of parallel strips, alternating direction */
      r => { const c = 21, out = [];
        for (let i = -1; i <= 5; i++) for (let j = -1; j <= 5; j++) {
          const hz = (i + j) & 1, x = i * c - 4, yy = j * c - 4;
          for (let k = 0; k < 3; k++) out.push({ pts: hz ? rect(x, yy + k * c / 3, c, c / 3) : rect(x + k * c / 3, yy, c / 3, c), o: hz ? 'h' : 'v', fill: tint(hz ? ASH : OAK, .92 + r() * .16) });
        }
        return { rot: 0, out }; },
      /* basket weave: paired planks, rows offset */
      r => { const c = 14, out = [];
        for (let j = -1; j <= 8; j++) for (let i = -2; i <= 8; i++) {
          const hz = (i + j) & 1, x = i * c + (j & 1 ? c / 2 : 0) - 4, yy = j * c - 4;
          for (let k = 0; k < 2; k++) out.push({ pts: hz ? rect(x, yy + k * c / 2, c, c / 2) : rect(x + k * c / 2, yy, c / 2, c), o: hz ? 'h' : 'v', fill: tint(hz ? OAK : WAL, .9 + r() * .2) });
        }
        return { rot: 0, out }; },
      /* rhombi: three faces of a cube */
      r => { const rad = 11, out = [], dx = Math.sqrt(3) * rad;
        for (let j = -2; j <= 9; j++) for (let i = -2; i <= 9; i++) {
          const cx = i * dx + (j & 1 ? dx / 2 : 0) - 4, cy = j * rad * 1.5 - 2;
          const V = hex(cx, cy, rad, -90); // 0 top,1 upper-right,2 lower-right,3 bottom,4 lower-left,5 upper-left
          out.push({ pts: [V[5], V[0], V[1], [cx, cy]], o: null, fill: tint(OAK, 1.14 + r() * .05) });
          out.push({ pts: [V[5], [cx, cy], V[3], V[4]], o: null, fill: tint(OAK, .86 + r() * .05) });
          out.push({ pts: [[cx, cy], V[1], V[2], V[3]], o: null, fill: tint(OAK, .6 + r() * .05) });
        }
        return { rot: 0, out }; },
      /* honeycomb */
      r => { const rad = 8.6, out = [], dx = Math.sqrt(3) * rad;
        for (let j = -2; j <= 12; j++) for (let i = -2; i <= 12; i++) {
          const cx = i * dx + (j & 1 ? dx / 2 : 0) - 4, cy = j * rad * 1.5 - 2;
          out.push({ pts: hex(cx, cy, rad - .15, 30), o: null, fill: tint(ASH, .86 + r() * .2) });
        }
        return { rot: 0, out }; }
    ];

    let cur = -1, nonce = 0;
    function build(i) {
      cur = i;
      const r = rnd(7 + i * 31), pat = gens[i](r);
      g.setAttribute('transform', pat.rot ? `rotate(${pat.rot} 50 50)` : '');
      g.classList.remove('is-built');
      g.innerHTML = pat.out.map((p, k) => {
        const pts = p.pts.map(q => q[0].toFixed(2) + ',' + q[1].toFixed(2)).join(' ');
        const dx = ((r() - .5) * 26).toFixed(1), dy = (22 + r() * 36).toFixed(1), rr = ((r() - .5) * 30).toFixed(1);
        const dl = Math.round((k % 36) * 14 + r() * 160);
        return `<g style="--dx:${dx}px;--dy:${dy}px;--rr:${rr}deg;--dl:${dl}ms"><polygon points="${pts}" fill="${p.fill}"/>${p.o ? `<polygon points="${pts}" fill="url(#g${p.o})" class="gr"/>` : ''}</g>`;
      }).join('');
      const my = ++nonce;
      requestAnimationFrame(() => requestAnimationFrame(() => { if (my === nonce) g.classList.add('is-built'); }));
      btns.forEach((b, k) => { b.classList.toggle('is-active', k === i); b.setAttribute('aria-current', k === i ? 'true' : 'false'); });
      cap.textContent = NAMES[i];
    }
    // grain patterns follow each piece's long axis
    const defs = $('defs', sec.querySelector('svg'));
    defs.insertAdjacentHTML('beforeend',
      '<pattern id="gv" width="3.2" height="24" patternUnits="userSpaceOnUse"><path d="M.5 0V24M1.5 3V19M2.5 0V10" stroke="rgba(54,36,24,.22)" stroke-width=".22" fill="none"/></pattern>' +
      '<pattern id="gh" width="24" height="3.2" patternUnits="userSpaceOnUse"><path d="M0 .5H24M3 1.5H19M0 2.5H10" stroke="rgba(54,36,24,.22)" stroke-width=".22" fill="none"/></pattern>');

    btns.forEach((b, i) => b.addEventListener('click', () => {
      if (rm) { build(i); return; }
      const span = track.offsetHeight - vh;
      goto(trackTop(track) + ((i + .5) / btns.length) * span);
    }));
    build(0);
    if (!rm) addScrub(track, () => {
      const i = Math.min(btns.length - 1, Math.floor(trackProgress(track) * btns.length));
      if (i !== cur) build(i);
    });
  }

  /* ───────── image parallax ───────── */
  $$('[data-wipe]').forEach(fig => {
    const img = $('img', fig);
    if (!img || rm) return;
    const k = parseFloat(img.dataset.parallax || '.05');
    addScrub(fig, () => {
      const r = fig.getBoundingClientRect();
      const c = (r.top + r.height / 2 - vh / 2) / vh;
      img.style.setProperty('--py', (-c * k * r.height).toFixed(1) + 'px');
    });
  });

  /* ───────── projects: floating preview + cursor ring ───────── */
  const peek = $('[data-peek-box]'), cursor = $('[data-cursor]');
  let px = 0, py = 0, tpx = 0, tpy = 0, cx = -100, cy = -100, tcx = -100, tcy = -100;
  function pointerBusy() {
    return (fine && !rm) && (Math.abs(tmx - mx) > .002 || Math.abs(tmy - my) > .002 || Math.abs(tcx - cx) > .4 || Math.abs(tcy - cy) > .4 ||
      (peek && peek.classList.contains('is-on') && (Math.abs(tpx - px) > .4 || Math.abs(tpy - py) > .4)));
  }
  if (fine && !rm) {
    scrubs.push({ el: D.body, vis: true, fn: () => {
      mx = lerp(mx, tmx, .07); my = lerp(my, tmy, .07);
      cx = lerp(cx, tcx, .22); cy = lerp(cy, tcy, .22);
      if (cursor) { cursor.style.setProperty('--cx', cx.toFixed(1) + 'px'); cursor.style.setProperty('--cy', cy.toFixed(1) + 'px'); }
      if (peek) { px = lerp(px, tpx, .14); py = lerp(py, tpy, .14); peek.style.setProperty('--x', px.toFixed(1) + 'px'); peek.style.setProperty('--y', py.toFixed(1) + 'px'); }
    } });
    addEventListener('pointermove', e => {
      tcx = e.clientX; tcy = e.clientY;
      if (cursor) { cursor.classList.add('is-on'); cursor.classList.toggle('is-link', !!e.target.closest('a,button,[data-peek]')); }
      schedule();
    }, { passive: true });
    D.addEventListener('pointerleave', () => cursor && cursor.classList.remove('is-on'));
    if (peek) {
      const pimg = $('img', peek);
      $$('.prow[data-peek]').forEach(a => {
        a.addEventListener('pointerenter', e => { pimg.src = a.dataset.peek; tpx = px = e.clientX + 30; tpy = py = e.clientY - 130; peek.classList.add('is-on'); schedule(); });
        a.addEventListener('pointermove', e => { tpx = e.clientX + 30; tpy = e.clientY - 130; schedule(); });
        a.addEventListener('pointerleave', () => peek.classList.remove('is-on'));
      });
    }
  }
  // inline thumbnails on touch / small screens: reveal as rows scroll into view
  if (!fine) $$('.prow__img').forEach(im => { im.style.display = 'block'; });

  /* ───────── init ───────── */
  function resplit() { $$('[data-lines]').forEach(splitLines); }
  function start() {
    resplit();
    const ht = $('.hero__title');
    if (ht) { ht.style.setProperty('--d', '650ms'); requestAnimationFrame(() => ht.classList.add('is-in')); }
    initReveal();
    scrubs.forEach(s => s.fn(y, ys));
    schedule();
  }
  const fontsReady = D.fonts && D.fonts.ready ? Promise.race([D.fonts.ready, new Promise(r => setTimeout(r, 1200))]) : Promise.resolve();
  fontsReady.then(start);
})();
