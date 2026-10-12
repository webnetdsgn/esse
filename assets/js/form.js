/* ESSE contact form.
   • If data-endpoint is set (see data/company.json → form_endpoint) the form POSTs JSON there.
   • Otherwise it opens the visitor's mail client with the message prepared — nothing is lost, no backend needed.
   • ?sample=Name in the URL pre-fills a sample request. */
(() => {
  'use strict';
  const form = document.querySelector('[data-form]');
  if (!form) return;
  const status = form.querySelector('[data-form-status]');
  const f = n => form.elements[n];

  const sample = new URLSearchParams(location.search).get('sample');
  if (sample && f('message') && !f('message').value) f('message').value = `Прошу выслать образец: ${sample.slice(0, 60)}.`;

  const say = (t, bad) => { status.textContent = t; status.style.color = bad ? '#9A3A2B' : ''; };
  const mark = (el, bad) => { el.setAttribute('aria-invalid', bad ? 'true' : 'false'); };

  function validate() {
    let first = null;
    const name = f('name').value.trim(), phone = f('phone').value.replace(/\D/g, '');
    [[f('name'), name.length < 2], [f('phone'), phone.length < 10], [f('consent'), !f('consent').checked]].forEach(([el, bad]) => {
      mark(el, bad); if (bad && !first) first = el;
    });
    if (f('email').value && !f('email').validity.valid) { mark(f('email'), true); first = first || f('email'); } else mark(f('email'), false);
    return first;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const bad = validate();
    if (bad) {
      say(bad === f('consent') ? 'Подтвердите согласие на обработку данных.' : bad === f('phone') ? 'Укажите телефон с кодом города или оператора.' : bad === f('name') ? 'Как к вам обращаться?' : 'Проверьте адрес почты.', true);
      bad.focus();
      return;
    }
    const data = { name: f('name').value.trim(), phone: f('phone').value.trim(), email: f('email').value.trim(), message: f('message').value.trim(), page: location.href };
    const endpoint = (form.dataset.endpoint || '').trim();
    if (endpoint) {
      try {
        say('Отправляем…');
        const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (!r.ok) throw new Error(r.status);
        form.reset();
        say('Спасибо! Мы получили сообщение и свяжемся с вами в рабочее время.');
      } catch (err) {
        say('Не удалось отправить. Позвоните нам или напишите на ' + form.dataset.email + '.', true);
      }
      return;
    }
    const body = `Имя: ${data.name}\nТелефон: ${data.phone}\nE-mail: ${data.email || '—'}\n\n${data.message || '(без сообщения)'}`;
    location.href = `mailto:${form.dataset.email}?subject=${encodeURIComponent('Сообщение с сайта ESSE')}&body=${encodeURIComponent(body)}`;
    say('Открываем почтовую программу с подготовленным письмом. Если ничего не произошло — напишите на ' + form.dataset.email + '.');
  });
  form.addEventListener('input', e => { if (e.target.getAttribute('aria-invalid') === 'true') mark(e.target, false); });
})();
