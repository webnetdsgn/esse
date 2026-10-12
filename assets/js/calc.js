/* ESSE flooring calculator — standalone, no dependencies.
   Embed anywhere (including e-dz.ru product pages):
     <form data-calc data-phone="+74951362159" data-email="info@parket-esse.ru"> … see catalog.html … </form>
     <script src="calc.js" defer></script>
   Reserve rule (from ESSE's technical sheet): +7 % for straight laying, +12 % for diagonal. */
(() => {
  'use strict';
  const form = document.querySelector('[data-calc]');
  if (!form) return;
  const rm = document.documentElement.classList.contains('rm');
  const n1 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const n2 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
  const n0 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
  const out = k => form.querySelector(`[data-out="${k}"]`);
  const sumRow = form.querySelector('[data-out-row="sum"]');
  const num = el => { const v = parseFloat(String(el.value).replace(',', '.')); return Number.isFinite(v) ? v : NaN; };
  const shown = {};

  function tween(key, to, fmt) {
    const el = out(key);
    if (!el) return;
    if (to == null || !Number.isFinite(to)) { el.textContent = '—'; shown[key] = 0; return; }
    const from = shown[key] || 0, t0 = performance.now(), d = rm ? 1 : 520;
    (function step(t) {
      const k = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step); else shown[key] = to;
    })(t0);
  }

  let last = null;
  function calc() {
    const area = num(form.area), pack = num(form.pack), price = num(form.price);
    const k = +(form.querySelector('input[name="layout"]:checked') || { value: 7 }).value;
    if (!(area > 0) || !(pack > 0)) { last = null; tween('packs', NaN); tween('need', NaN); tween('total', NaN); sumRow.hidden = true; return; }
    const need = area * (1 + k / 100);
    const packs = Math.ceil(need / pack - 1e-9);
    const total = packs * pack;
    const sum = price > 0 ? total * price : NaN;
    last = { area, k, pack, need, packs, total, sum };
    tween('packs', packs, v => n0.format(Math.round(v)));
    tween('need', need, v => n1.format(v));
    tween('total', total, v => n2.format(v));
    sumRow.hidden = !(sum > 0);
    if (sum > 0) tween('sum', sum, v => n0.format(Math.round(v)));
  }

  form.addEventListener('input', calc);
  form.addEventListener('submit', e => e.preventDefault());

  const send = form.querySelector('[data-calc-send]');
  if (send) send.addEventListener('click', () => {
    if (!last) return;
    const l = last;
    const body = [
      'Здравствуйте! Прошу подтвердить расчёт паркета.', '',
      `Площадь помещения: ${n1.format(l.area)} м²`,
      `Схема укладки: ${l.k === 12 ? 'по диагонали' : 'прямая'} (запас +${l.k} %)`,
      `Площадь в упаковке: ${n2.format(l.pack)} м²`,
      `Нужно с запасом: ${n1.format(l.need)} м²`,
      `Упаковок: ${l.packs} (${n2.format(l.total)} м²)`,
      Number.isFinite(l.sum) ? `Ориентировочная сумма: ${n0.format(Math.round(l.sum))} ₽` : '',
      '', 'Имя и телефон для связи: '
    ].filter((s, i, a) => !(s === '' && a[i - 1] === '')).join('\n');
    send.setAttribute('href', `mailto:${form.dataset.email}?subject=${encodeURIComponent('Расчёт количества паркета')}&body=${encodeURIComponent(body)}`);
  });
  calc();
})();
