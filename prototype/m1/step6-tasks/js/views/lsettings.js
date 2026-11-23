/*
 * M1 · Step 7 · Settings, Linear style (chosen from prototype/explorations/settings-linear.html).
 * One full-page shell for every settings route: a quiet sidebar with Portal and Modules (Projects first; Tasks, then Issues, ... marked Soon),
 * a ⌘K / "/" command palette, and a content column. Also the small UI kit the Layouts page uses: popovers, dialogs, toasts, the save bar.
 * Portal, Users, Audit log and My preferences reuse Settings.*Tab; Fields reuses CustomFields.*; Layouts is in layouts.js.
 */
const LSettings = (() => {
  const { esc: E, icon: pyIcon, Router } = PY;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
  const TOAST_MS = 2400, TOAST_ERR_MS = 4200;

  /* ---------- icons ---------- */
  const P = {
    portal: '<rect x="2.5" y="3" width="11" height="10.5" rx="1.5"/><path d="M2.5 6.5h11M6 3v3.5"/>',
    users: '<circle cx="6" cy="5.5" r="2.2"/><path d="M2 13c.4-2.2 2-3.4 4-3.4s3.6 1.2 4 3.4M10.5 3.6a2.2 2.2 0 0 1 0 3.8M12 9.9c1.2.5 1.9 1.5 2.1 3"/>',
    audit: '<path d="M3 4h10M3 8h10M3 12h6"/>',
    prefs: '<path d="M3 5h5M11 5h2M3 11h2M8 11h5"/><circle cx="9.5" cy="5" r="1.5"/><circle cx="6.5" cy="11" r="1.5"/>',
    projects: '<path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.8l1.4 1.5h4.8A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z"/>',
    tasks: '<rect x="2.5" y="2.5" width="11" height="11" rx="2"/><path d="M5.5 8.2l1.8 1.8 3.2-3.6"/>',
    issues: '<circle cx="8" cy="8" r="5.5"/><path d="M8 5v3.5M8 10.8v.1"/>',
    documents: '<path d="M4 2.5h5l3 3v8H4z"/><path d="M9 2.5v3h3"/>',
    time: '<circle cx="8" cy="8" r="5.5"/><path d="M8 5v3l2 1.2"/>',
    fields: '<rect x="2.5" y="3" width="11" height="3" rx="1"/><rect x="2.5" y="9" width="11" height="3" rx="1"/>',
    layouts: '<rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M2.5 6.5h11M7 6.5v7"/>',
    statuses: '<circle cx="8" cy="8" r="5.5"/><path d="M8 4.5a3.5 3.5 0 0 1 0 7z" fill="currentColor"/>',
    templates: '<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 3.5h-6a1 1 0 0 0-1 1v6"/>',
    plus: '<path d="M8 3v10M3 8h10"/>',
    grip: '<g fill="currentColor" stroke="none"><circle cx="6" cy="4" r="1"/><circle cx="10" cy="4" r="1"/><circle cx="6" cy="8" r="1"/><circle cx="10" cy="8" r="1"/><circle cx="6" cy="12" r="1"/><circle cx="10" cy="12" r="1"/></g>',
    more: '<g fill="currentColor" stroke="none"><circle cx="3.5" cy="8" r="1.1"/><circle cx="8" cy="8" r="1.1"/><circle cx="12.5" cy="8" r="1.1"/></g>',
    up: '<path d="M4 9.5L8 5.5l4 4"/>', down: '<path d="M4 6.5l4 4 4-4"/>',
    trash: '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8h5.8l.6-8"/>',
    back: '<path d="M9.5 3.5L5 8l4.5 4.5"/>', search: '<circle cx="7" cy="7" r="4"/><path d="M10 10l3 3"/>',
    menu: '<path d="M3 4.5h10M3 8h10M3 11.5h10"/>', move: '<path d="M3 8h10M9.5 4.5L13 8l-3.5 3.5"/>',
    eye: '<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>',
    expand: '<path d="M2.5 8h11M5 5.5L2.5 8 5 10.5M11 5.5L13.5 8 11 10.5"/>', shrink: '<path d="M6 8H2.5M10 8h3.5M4.5 5.5L6.5 8l-2 2.5M11.5 5.5L9.5 8l2 2.5"/>',
    check: '<path d="M3.5 8.5l3 3 6-6.5"/>', x: '<path d="M4 4l8 8M12 4l-8 8"/>',
  };
  P.folders = P.projects; P.rules = P.prefs;
  const ico = (n, s = 14) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

  /* ---------- the navigation model (module-wise) ---------- */
  /** [id, label, icon, permission needed to see it] */
  const PORTAL_PAGES = [['portal', 'Portal profile', 'portal', null], ['users', 'Users & profiles', 'users', 'USERS_VIEW'], ['audit', 'Audit log', 'audit', 'AUDIT_VIEW'], ['preferences', 'My preferences', 'prefs', null]];
  const PROJECT_PAGES = [['fields', 'Fields', 'CUSTOM_FIELDS_VIEW'], ['layouts', 'Layouts', 'CUSTOM_FIELDS_VIEW'], ['statuses', 'Statuses', 'PROJECTS_VIEW'], ['templates', 'Templates', 'PROJECTS_VIEW']];
  const TASK_PAGES = [['fields', 'Fields', 'CUSTOM_FIELDS_VIEW'], ['layouts', 'Layouts', 'CUSTOM_FIELDS_VIEW'], ['statuses', 'Statuses', 'CUSTOM_FIELDS_VIEW']];
  const SOON = [
    { id: 'issues', name: 'Issues', note: 'Arrives with Step 9', pages: ['Fields', 'Layouts', 'Statuses'] },
    { id: 'documents', name: 'Documents', note: 'Arrives in M1', pages: ['Fields', 'Folders'] }, { id: 'time', name: 'Time tracking', note: 'Planned for later', pages: ['Fields', 'Rules'] },
  ];
  const href = (ctx, path) => `#/p/${ctx.slug}/settings/${path}`;

  /* ---------- state of the page being shown ---------- */
  let el = null, keyHandler = null, leaveHandler = null, bound = false;
  const sink = () => el || document.body;

  /* ---------- small helpers ---------- */
  const chip = (t, c = '') => `<span class="chip ${c}">${E(t)}</span>`;
  const head = (t, d = '', a = '', crumb = '') => `<header class="ph"><div>${crumb ? `<div class="crumb">${crumb}</div>` : ''}<h1>${t}</h1>${d ? `<p>${d}</p>` : ''}</div>${a}</header>`;
  const typing = (n) => !!n && (n.isContentEditable || n.tagName === 'TEXTAREA' || n.tagName === 'SELECT' || (n.tagName === 'INPUT' && !['radio', 'checkbox', 'button'].includes(n.type)));
  function toast(msg, kind = '') {
    const host = $('#toasts', sink()); if (!host) return;
    const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg; host.appendChild(t);
    setTimeout(() => t.remove(), kind ? TOAST_ERR_MS : TOAST_MS);
  }

  /* ---------- popover ---------- */
  let pop = null, popKind = '', popClose = null;
  function closePop() { if (!pop) return; pop.remove(); pop = null; const f = popClose; popClose = null; popKind = ''; if (f) f(); }
  function openPop(anchor, html, { kind = '', alignRight = false, offset = 0, onClose = null } = {}) {
    closePop();
    pop = document.createElement('div'); pop.className = 'pop'; pop.innerHTML = html; pop.style.visibility = 'hidden'; popKind = kind; popClose = onClose;
    sink().appendChild(pop);
    const r = anchor.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    let left = alignRight ? r.right - w : r.left + offset; left = Math.min(Math.max(8, left), innerWidth - w - 8);
    let top = r.bottom + 4; if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 4);
    pop.style.left = left + 'px'; pop.style.top = top + 'px'; pop.style.visibility = '';
    return pop;
  }
  function setAct(ul, i) {
    const items = [...ul.children].filter((li) => !li.hidden); items.forEach((li) => li.classList.remove('act'));
    if (!items.length) return; i = (i + items.length) % items.length; items[i].classList.add('act'); items[i].scrollIntoView({ block: 'nearest' }); return i;
  }
  /** Arrow keys and Enter on a search box that filters a list. */
  function listNav(input, ul, pick) {
    let i = 0; setAct(ul, 0);
    input.addEventListener('input', () => { i = 0; setAct(ul, 0); });
    input.addEventListener('keydown', (e) => {
      const items = [...ul.children].filter((li) => !li.hidden);
      if (e.key === 'ArrowDown') { e.preventDefault(); i = setAct(ul, i + 1); } else if (e.key === 'ArrowUp') { e.preventDefault(); i = setAct(ul, i - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); if (items[i]) pick(items[i]); }
    });
  }

  /* ---------- dialog (native <dialog>, so focus and Esc behave) ---------- */
  function dialog(title, body, submit, onSubmit) {
    const prev = document.activeElement;
    const d = document.createElement('dialog'); d.className = 'dlg'; d.setAttribute('aria-label', title);
    d.innerHTML = `<form novalidate><h2>${title}</h2>${body}<p class="err" role="alert" hidden></p><div class="dlg-f"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary">${submit}</button></div></form>`;
    sink().appendChild(d);
    const err = $('.err', d);
    d.addEventListener('close', () => { d.remove(); if (prev && prev.isConnected) prev.focus({ preventScroll: true }); });
    $('[data-close]', d).onclick = () => d.close();
    $('form', d).onsubmit = async (e) => {
      e.preventDefault();
      const form = e.target; $('button.primary', d).disabled = true;
      let msg; try { msg = await onSubmit(form, d); } catch (x) { msg = x.message; }
      $('button.primary', d).disabled = false;
      if (msg) { err.textContent = msg; err.hidden = false; } else d.close();
    };
    d.showModal(); const f = $('input,select,textarea', d); if (f) f.focus();
    return d;
  }

  /* ---------- the save bar (Layouts builder) ---------- */
  const bar = { show: (on, disabled = false) => { const b = $('#bar', sink()); if (!b) return; b.hidden = !on; const s = $('#savebtn', b); if (s) s.disabled = disabled; } };

  /* ---------- palette ---------- */
  function entries(ctx) {
    const can = (p) => !p || ctx.can(p);
    return [
      ...PORTAL_PAGES.filter(([, , , p]) => can(p)).map(([id, l, ic]) => ({ label: l, hint: 'Portal', href: href(ctx, id), ic })),
      ...PROJECT_PAGES.filter(([, , p]) => can(p)).map(([id, l]) => ({ label: 'Projects › ' + l, hint: 'Projects', href: href(ctx, 'projects/' + id), ic: id })),
      ...TASK_PAGES.filter(([, , p]) => can(p)).map(([id, l]) => ({ label: 'Tasks › ' + l, hint: 'Tasks', href: href(ctx, 'tasks/' + id), ic: id })),
      ...SOON.map((m) => ({ label: m.name, hint: 'Soon', href: href(ctx, m.id), ic: m.id })),
      { label: 'Back to the app', hint: 'ProjectY', href: `#/p/${ctx.slug}`, ic: 'back' },
    ];
  }
  function openPalette(ctx) {
    const d = $('#pal', el); if (!d) return; closePop();
    const q = $('#pal-q', d), ul = $('#pal-l', d); let i = 0;
    const draw = () => {
      const t = q.value.trim().toLowerCase(), items = entries(ctx).filter((e) => (e.label + ' ' + e.hint).toLowerCase().includes(t));
      ul.innerHTML = items.length ? items.map((e) => `<li role="option" data-href="${E(e.href)}">${ico(e.ic)}<span>${E(e.label)}</span><small>${E(e.hint)}</small></li>`).join('') : '<li class="none" style="cursor:default">No matching page</li>';
      i = setAct(ul, 0) ?? 0;
    };
    const go = (li) => { if (!li.dataset.href) return; d.close(); location.hash = li.dataset.href; };
    q.oninput = draw;
    q.onkeydown = (e) => {
      const items = [...ul.children].filter((li) => li.dataset.href);
      if (e.key === 'ArrowDown') { e.preventDefault(); i = setAct(ul, i + 1); } else if (e.key === 'ArrowUp') { e.preventDefault(); i = setAct(ul, i - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); if (items[i]) go(items[i]); }
    };
    ul.onclick = (e) => { const li = e.target.closest('li'); if (li) go(li); };
    d.onmousedown = (e) => { if (e.target === d) d.close(); };
    if (!d.open) d.showModal(); q.value = ''; draw(); q.focus();
  }

  /* ---------- pages that only need a list ---------- */
  const STATUS_TYPES = ['Active', 'On hold', 'Completed', 'Cancelled'];
  const STATUS_COLOR = { Active: 'var(--acc)', 'On hold': 'var(--mut2)', Completed: 'var(--ok)', Cancelled: 'var(--danger)' };
  function statuses(content) {
    content.innerHTML = STATUS_TYPES.map((t) => `<div class="gt">${t}</div><div class="group">${Store.PROJECT_STATUSES.filter((s) => s.type === t).map((s) =>
      `<div class="srow" style="padding:9px 16px"><div class="l" style="display:flex;align-items:center;gap:10px"><span class="dot" style="background:${STATUS_COLOR[t]}"></span><b>${E(s.name)}</b></div><div class="r muted">${t}</div></div>`).join('')
      || '<div class="srow"><div class="l muted">No statuses of this type.</div></div>'}</div>`).join('') + '<p class="foot">Editing statuses arrives with the statuses part of this step.</p>';
  }
  function templates(content) {
    content.innerHTML = `<div class="group"><div class="srow"><div class="l"><b>No templates yet</b><span>Project templates (phases, tasks and documents to start from) arrive with a later step.</span></div></div></div>`;
  }
  function soon(content, m) {
    content.innerHTML = `<div class="notice">Settings for ${E(m.name)} will appear here when the module arrives. ${E(m.note)}.</div>
      <div class="group grey" aria-disabled="true">${m.pages.map((p) => `<div class="srow"><div class="l" style="display:flex;gap:10px;align-items:center">${ico(p.toLowerCase())}<b>${E(p)}</b></div><div class="r muted">Not available yet</div></div>`).join('')}</div>`;
  }

  /* ---------- the shell ---------- */
  /**
   * @param page { nav: 'portal' | 'projects/fields' | ..., title, heading?: [title, description], wide?, mount(contentEl, ctx), keys?(e) }
   */
  function render(rootEl, ctx, page) {
    if (leaveHandler) { const f = leaveHandler; leaveHandler = null; f(); }
    closePop(); keyHandler = null;
    const can = (p) => !p || ctx.can(p), cur = page.nav;
    const item = (to, ic, label, id, extra = '', dim = '') => `<a class="ni ${dim}" href="${to}" ${cur === id ? 'aria-current="page"' : ''}>${ico(ic)}<span>${label}</span>${extra}</a>`;
    const nav = `<div class="gl">Portal</div>${PORTAL_PAGES.filter(([, , , p]) => can(p)).map(([id, l, ic]) => item(href(ctx, id), ic, l, id)).join('')}
      <div class="gl">Modules</div><div class="ni" style="color:var(--tx);font-weight:500;cursor:default">${ico('projects')}<span>Projects</span></div>
      <div class="sub">${PROJECT_PAGES.filter(([, , p]) => can(p)).map(([id, l]) => item(href(ctx, 'projects/' + id), id, l, 'projects/' + id)).join('')}</div>
      <div class="ni" style="color:var(--tx);font-weight:500;cursor:default">${ico('tasks')}<span>Tasks</span></div>
      <div class="sub">${TASK_PAGES.filter(([, , p]) => can(p)).map(([id, l]) => item(href(ctx, 'tasks/' + id), id, l, 'tasks/' + id)).join('')}</div>
      ${SOON.map((m) => item(href(ctx, m.id), m.id, m.name, m.id, '<span class="soon">Soon</span>', 'dim')).join('')}`;
    rootEl.innerHTML = `<div class="lset"><div class="app">
      <aside class="side" id="side" aria-label="Settings navigation">
        <a class="back" href="#/p/${E(ctx.slug)}">${ico('back')}<span>Back to app</span></a>
        <button class="sbtn" type="button" id="sbtn" aria-label="Search settings">${ico('search')}<span>Search settings</span><kbd>${MOD}K</kbd></button>
        <nav aria-label="Settings">${nav}</nav>
        <div class="lfoot"><span class="who">${E(ctx.me.fullName)}</span>${PY.themeButton('ibtn')}</div>
      </aside>
      <div class="scrim" id="scrim" aria-hidden="true"></div>
      <div><div class="topbar"><button class="ibtn" type="button" id="menubtn" aria-label="Open settings menu">${ico('menu', 16)}</button><b>${E(page.title)}</b></div>
        <main id="main" tabindex="-1"><div class="col${page.full ? ' full' : page.wide ? ' wide' : ''}">${page.heading ? head(page.heading[0], page.heading[1] || '') : ''}<div id="page"></div></div></main></div>
    </div>
    <div id="bar" role="region" aria-label="Unsaved changes" hidden><span class="tx">Unsaved changes</span><button class="btn ghost" type="button" id="discardbtn">Discard</button><button class="btn primary" type="button" id="savebtn">Save changes</button></div>
    <div id="toasts" role="status" aria-live="polite"></div>
    <dialog class="pal" id="pal" aria-label="Jump to a settings page"><input id="pal-q" type="text" placeholder="Jump to a settings page…" autocomplete="off" aria-label="Search settings pages"><ul id="pal-l" role="listbox"></ul>
      <div class="ph2"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>Esc</kbd> close</span></div></dialog></div>`;
    el = rootEl.querySelector('.lset');
    PY.wireThemeToggle(el);
    $('#sbtn', el).onclick = () => openPalette(ctx);
    $('#menubtn', el).onclick = () => el.classList.toggle('drawer');
    $('#scrim', el).onclick = () => el.classList.remove('drawer');
    document.title = page.title + ' · Settings · ProjectY';
    if (page.keys) keyHandler = page.keys;
    if (!bound) {
      bound = true;
      document.addEventListener('mousedown', (e) => { if (pop && !pop.contains(e.target)) closePop(); }, true);
      document.addEventListener('keydown', (e) => {
        if (!el || !el.isConnected) return;
        const mod = e.metaKey || e.ctrlKey, k = e.key;
        if (mod && k.toLowerCase() === 'k') { e.preventDefault(); const d = $('#pal', el); if (d.open) d.close(); else openPalette(el._ctx); return; }
        if (k === 'Escape') {
          if (pop) { e.preventDefault(); closePop(); return; }
          if (el.classList.contains('drawer')) { el.classList.remove('drawer'); return; }
        }
        if ($('dialog[open]', el)) return;
        if (k === '/' && !typing(e.target) && !mod) { e.preventDefault(); openPalette(el._ctx); return; }
        if (keyHandler) keyHandler(e);
      });
    }
    el._ctx = ctx;
    page.mount($('#page', el), ctx);
  }

  return { render, ico, chip, head, toast, openPop, closePop, setAct, listNav, dialog, bar, typing, MOD, statuses, templates, soon, SOON, href,
    setKeys: (f) => { keyHandler = f; }, isPopOpen: () => !!pop, popKind: () => popKind, popEl: () => pop, onLeave: (f) => { leaveHandler = f; } };
})();
