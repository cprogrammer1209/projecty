/*
 * Shared helpers: html building, text/date utils, theme, router, and a tiny component helper.
 * Everything hangs off one global `PY` so the plain <script> tags can share it.
 */
const PY = (() => {
  const PASSWORD_MIN_LENGTH = 10;
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const DATE_FORMATS = ['MMM d, yyyy', 'd MMM yyyy', 'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'];
  const WEEK_STARTS = [
    { value: 'MONDAY', label: 'Monday' },
    { value: 'SUNDAY', label: 'Sunday' },
    { value: 'SATURDAY', label: 'Saturday' },
  ];

  /* ---------- html ---------- */
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name) => `<py-icon name="${name}"></py-icon>`;
  const spinner = '<span class="py-spinner" aria-hidden="true"></span>';

  /** Angular <py-field>: label + control + hint/error. `action` goes next to the label (the fieldAction slot). */
  function field({ label, id, error = null, hint = null, action = '', body }) {
    const msg = error
      ? `<p class="py-field__error" id="${id}-error">${icon('alert')}${esc(error)}</p>`
      : hint ? `<p class="py-field__hint" id="${id}-hint">${esc(hint)}</p>` : '';
    return `<div class="py-field${error ? ' is-invalid' : ''}">
      <div class="py-field__row"><label class="py-field__label" for="${id}">${esc(label)}</label>${action}</div>
      ${body}${msg}</div>`;
  }

  /** Angular <py-input-wrap> + input. */
  function input({ id, name, type = 'text', value = '', placeholder = '', autocomplete = '', error = null, disabled = false }) {
    return `<div class="py-input-wrap"><input id="${id}" name="${name || id}" type="${type}" value="${esc(value)}"
      ${placeholder ? `placeholder="${esc(placeholder)}"` : ''} ${autocomplete ? `autocomplete="${autocomplete}"` : ''}
      ${error ? `aria-invalid="true" aria-describedby="${id}-error"` : ''} ${disabled ? 'disabled' : ''} /></div>`;
  }

  /** Angular <py-password-input>. The show/hide button is wired by wirePasswordToggles(). */
  function passwordInput({ id, name, value = '', autocomplete = 'current-password', error = null, describedBy = null }) {
    return `<div class="py-input-wrap"><input id="${id}" name="${name || id}" type="password" value="${esc(value)}"
      autocomplete="${autocomplete}" ${error ? 'aria-invalid="true"' : ''}
      ${describedBy || error ? `aria-describedby="${error ? id + '-error' : describedBy}"` : ''} />
      <button class="toggle" type="button" data-toggle-password aria-label="Show password">${icon('eye')}</button></div>`;
  }
  function wirePasswordToggles(root) {
    root.querySelectorAll('[data-toggle-password]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = btn.parentElement.querySelector('input');
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        btn.innerHTML = icon(show ? 'eye-off' : 'eye');
      });
    });
  }

  const alertBox = (text, kind = 'error', html = false) =>
    `<div class="py-alert${kind === 'ok' ? ' py-alert--ok' : ''}" role="${kind === 'ok' ? 'status' : 'alert'}">${icon(kind === 'ok' ? 'check' : 'alert')}<span>${html ? text : esc(text)}</span></div>`;

  const logo = `<a class="logo" href="#/" aria-label="ProjectY home">
    <svg class="logo__mark" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#2A5BD7"/>
      <path d="M19 16 L32 31 L45 16 M32 31 V48" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="32" cy="31" r="6.5" fill="#FFB547" stroke="#2A5BD7" stroke-width="2.5"/></svg>
    <span class="logo__word">ProjectY</span></a>`;

  /* ---------- text ---------- */
  const initials = (text) => (text || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const slugify = (text) => (text || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/, '');
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- dates (Angular formatDate + PyDatePipe, with Intl) ---------- */
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function zoneParts(date, timeZone) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23', weekday: 'long',
    }).formatToParts(date).map((x) => [x.type, x.value]));
    return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, weekday: p.weekday };
  }
  /** Supports the tokens the app uses: EEEE MMMM MMM MM yyyy dd d h mm a */
  function formatDate(value, pattern, timeZone = 'UTC') {
    if (value == null) return '';
    const p = zoneParts(new Date(value), timeZone);
    const pad = (n) => String(n).padStart(2, '0');
    const h12 = p.h % 12 || 12;
    const map = { EEEE: p.weekday, MMMM: MONTHS[p.m - 1], MMM: MONTHS[p.m - 1].slice(0, 3), MM: pad(p.m), yyyy: p.y, dd: pad(p.d), d: p.d, h: h12, mm: pad(p.min), a: p.h < 12 ? 'AM' : 'PM' };
    return pattern.replace(/EEEE|MMMM|MMM|MM|yyyy|dd|d|h|mm|a/g, (t) => map[t]);
  }
  const hourIn = (date, timeZone) => zoneParts(date, timeZone).h;
  const timeZones = (() => {
    try { return Intl.supportedValuesOf('timeZone'); } catch (e) { return ['UTC', 'Asia/Kolkata', 'Europe/London', 'America/New_York', 'America/Los_Angeles']; }
  })();
  const timeZoneOptions = (current) => (current && !timeZones.includes(current) ? [current, ...timeZones] : timeZones);
  const currencies = (() => {
    try {
      const names = new Intl.DisplayNames(['en'], { type: 'currency' });
      return Intl.supportedValuesOf('currency').map((code) => ({ code, label: `${code} — ${names.of(code) ?? code}` }));
    } catch (e) { return ['USD', 'EUR', 'GBP', 'INR'].map((code) => ({ code, label: code })); }
  })();

  /* ---------- theme (ThemeService): explicit choice in localStorage 'py-theme', else the OS ---------- */
  const theme = {
    current() {
      const set = document.documentElement.getAttribute('data-theme');
      if (set) return set;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    },
    toggle() {
      const next = theme.current() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('py-theme', next); } catch (e) {}
    },
  };
  const themeButton = (cls = 'py-btn py-btn--ghost py-btn--icon') => {
    const dark = theme.current() === 'dark';
    return `<button class="${cls}" type="button" data-theme-toggle aria-label="${dark ? 'Switch to light theme' : 'Switch to dark theme'}">${icon(dark ? 'sun' : 'moon')}</button>`;
  };
  function wireThemeToggle(root) {
    root.querySelectorAll('[data-theme-toggle]').forEach((b) => b.addEventListener('click', () => {
      theme.toggle(); // swap the icon in place so nothing the user typed is lost
      const dark = theme.current() === 'dark';
      document.querySelectorAll('[data-theme-toggle]').forEach((x) => {
        x.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
        x.innerHTML = icon(dark ? 'sun' : 'moon');
      });
    }));
  }

  /* ---------- router (hash based) ---------- */
  const Router = {
    routes: [],
    cleanup: null,
    /** path like '/p/:slug/settings' -> regex; first match wins. */
    add(path, handler) {
      const keys = [];
      const rx = new RegExp('^' + path.replace(/:[a-z]+/g, (m) => { keys.push(m.slice(1)); return '([^/]+)'; }) + '/?$');
      Router.routes.push({ rx, keys, handler });
    },
    location() {
      const raw = location.hash.replace(/^#/, '') || '/';
      const [path, qs] = raw.split('?');
      return { path, query: Object.fromEntries(new URLSearchParams(qs || '')) };
    },
    navigate(url, { replace = false } = {}) {
      const target = '#' + url;
      if (location.hash === target) return Router.rerender();
      if (replace) location.replace(target); else location.hash = target;
    },
    rerender() { Router.resolve(); },
    resolve() {
      const { path, query } = Router.location();
      for (const r of Router.routes) {
        const m = r.rx.exec(path);
        if (!m) continue;
        const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        return r.handler({ path, query, params });
      }
      Router.navigate('/sign-in', { replace: true });
    },
    start() { window.addEventListener('hashchange', Router.resolve); Router.resolve(); },
  };
  const qs = (obj) => { const s = new URLSearchParams(obj).toString(); return s ? '?' + s : ''; };

  /**
   * A tiny component: keeps `state`, re-renders `el.innerHTML` on set(), then calls bind(el, api).
   * Fields keep their typed values in state (render writes them back), so a re-render after submit keeps the form.
   */
  function component(el, state, render, bind) {
    const api = {
      state,
      el,
      set(patch) { Object.assign(state, patch); api.paint(); },
      paint() { el.innerHTML = render(state); wirePasswordToggles(el); wireThemeToggle(el); if (bind) bind(el, api); },
    };
    api.paint();
    return api;
  }

  /** Focus the first invalid control, like focusFirstInvalid() in the app. */
  const focusFirstInvalid = (root) => root.querySelector('[aria-invalid="true"]')?.focus();

  return { PASSWORD_MIN_LENGTH, EMAIL_PATTERN, DATE_FORMATS, WEEK_STARTS, esc, icon, spinner, field, input, passwordInput, wirePasswordToggles, alertBox, logo, initials, slugify, delay,
    formatDate, hourIn, timeZoneOptions, currencies, theme, themeButton, wireThemeToggle, Router, qs, component, focusFirstInvalid };
})();
