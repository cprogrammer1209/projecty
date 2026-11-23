/*
 * M1 · Step 6 · The task list engine, Linear style (shared by project → Tasks and the portal My Tasks / All Tasks).
 *   TaskList.mount(host, opts) draws: toolbar (Filter, search, Display, New task), removable filter chips, a List or a Board of groups,
 *   a bulk bar, a hint bar. It owns: grouping (status, task list, owner, priority, due, none), client-side filters, inline pickers on rows,
 *   quick add per group, the New task modal, the peek side panel (which mounts Tasks.detail in peek mode), keyboard shortcuts and drag on the board.
 *   TaskList.palette(...) is the Ctrl+K command menu (also used on the task page).
 * The host (js/views/tasks.js, alltasks.js) only supplies data (opts.load) and a few buttons (opts.extra). Every mutation goes through Store,
 * and every status change through Store.setTaskStatus (the single status path, TSK-BR-05/07).
 */
const TaskList = (() => {
  const { esc, icon, formatDate, initials, Router } = PY;
  const hexOf = (key) => (Store.STATUS_COLORS.find(([k]) => k === key) || Store.STATUS_COLORS[0])[2];
  const PRIO = Object.fromEntries(Store.TASK_PRIORITIES);
  const PRIO_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'];
  const GROUPS = [['status', 'Status'], ['list', 'Task list'], ['owner', 'Owner'], ['priority', 'Priority'], ['due', 'Due date'], ['none', 'No grouping']];
  const plural = (n, w) => `${n} ${n === 1 ? w : w + 's'}`;
  const isoDay = (n) => { const d = new Date(); d.setDate(d.getDate() + n); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
  const day = (d, ctx) => (d ? formatDate(new Date(d + 'T00:00:00Z'), ctx.portal.dateFormat, 'UTC') : '');

  /* ---------- small icons ---------- */
  const I = {
    plus: '<path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    filter: '<path d="M2.5 4h11M4.5 8h7M6.5 12h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
    disp: '<path d="M2.5 5h6M11.5 5h2M2.5 11h2M7.5 11h6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="10" cy="5" r="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="6" cy="11" r="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/>',
    list: '<path d="M2.5 4h11M2.5 8h11M2.5 12h11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
    board: '<rect x="2.5" y="2.5" width="3.2" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="6.4" y="2.5" width="3.2" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="10.3" y="2.5" width="3.2" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/>',
    car: '<path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
    x: '<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    expand: '<path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5L9 7M2.5 13.5L7 9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
    up: '<path d="M4 10l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
    down: '<path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
    cal: '<rect x="2.5" y="3.5" width="11" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M2.5 7h11M5.5 2v3M10.5 2v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
    sub: '<path d="M4 2.5v6a2 2 0 0 0 2 2h6M9.5 8l2.5 2.5L9.5 13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
    search: '<circle cx="7" cy="7" r="4.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10.2 10.2L13.5 13.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
    stack: '<path d="M8 2l6 3-6 3-6-3zM2 8l6 3 6-3M2 11l6 3 6-3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
  };
  const ic = (n, s = 14) => `<svg width="${s}" height="${s}" viewBox="0 0 16 16" aria-hidden="true">${I[n]}</svg>`;
  /** Status icon from the layout status: Closed = filled tick, the default Open status = dashed ring, other Open = ring with a half pie. */
  const statusIcon = (st, s = 14) => {
    const c = hexOf(st.color), closed = st.type === 'CLOSED';
    const base = `<circle cx="7" cy="7" r="5.6" fill="none" stroke="${c}" stroke-width="1.5"${!closed && st.isDefault ? ' stroke-dasharray="2.2 1.9"' : ''}/>`;
    const inner = closed ? `<circle cx="7" cy="7" r="6.3" fill="${c}"/><path d="M4.4 7.2L6.2 9l3.4-3.6" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>` : st.isDefault ? '' : `<path d="M7 3.6a3.4 3.4 0 0 1 0 6.8z" fill="${c}"/>`;
    return `<svg class="pi" width="${s}" height="${s}" viewBox="0 0 14 14" aria-hidden="true">${base}${inner}</svg>`;
  };
  const prioIcon = (p, s = 14) => {
    if (p === 'CRITICAL') return `<svg class="pi" width="${s}" height="${s}" viewBox="0 0 14 14" aria-hidden="true"><rect x="1" y="1" width="12" height="12" rx="3" fill="#f2711c"/><path d="M7 3.8v4M7 9.6v.8" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>`;
    if (!p || p === 'NONE') return `<svg class="pi" width="${s}" height="${s}" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 7h2.5M5.8 7h2.4M9.5 7H12" stroke="#9a9da6" stroke-width="1.6" stroke-linecap="round"/></svg>`;
    const n = { LOW: 1, MEDIUM: 2, HIGH: 3 }[p];
    return `<svg class="pi" width="${s}" height="${s}" viewBox="0 0 14 14" aria-hidden="true">${[3, 6.6, 10.2].map((x, i) => `<rect x="${x}" y="${[8, 5, 2][i]}" width="2.4" height="${[4, 7, 10][i]}" rx=".8" fill="${i < n ? 'var(--py-ink)' : 'var(--py-border-control)'}"${i < n ? '' : ' opacity=".4"'}/>`).join('')}</svg>`;
  };
  const AVC = ['#5e6ad2', '#2f9e6f', '#d6457a', '#c2651b', '#1f8d7c', '#7c5cd6', '#3b82d9', '#a44a06'];
  const avatar = (name, s = 20) => (name
    ? `<span class="py-avatar tv-av" style="width:${s}px;height:${s}px;font-size:${Math.round(s * 0.42)}px;background:${AVC[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVC.length]}" title="${esc(name)}">${esc(initials(name))}</span>`
    : `<span class="tv-av none" style="width:${s}px;height:${s}px" title="Unassigned"></span>`);
  const ownerStack = (owners, s = 20) => (owners.length ? `<span class="avs">${owners.slice(0, 2).map((o) => avatar(o.name, s)).join('')}${owners.length > 2 ? `<span class="py-avatar tv-av more" style="width:${s}px;height:${s}px;font-size:${Math.round(s * 0.42)}px">+${owners.length - 2}</span>` : ''}</span>` : avatar(null, s));
  const kbd = (k) => `<span class="kbd">${esc(k)}</span>`;

  /* ---------- toast ---------- */
  function toast(msg) {
    let t = document.getElementById('tv-toast');
    if (!t) { t = document.createElement('div'); t.id = 'tv-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 3200);
  }

  /* ---------- popover ---------- */
  let openPop = null;
  function closePop() {
    if (!openPop) return;
    const p = openPop; openPop = null;
    p.el.remove(); document.removeEventListener('mousedown', p.away, true); document.removeEventListener('keydown', p.key, true); p.onClose?.();
  }
  /**
   * pop(anchor, { cls, title, items:[{id, html, on, text}], multi, search, footer, onFooter(el, close), onPick(id, item), draw(el, close) (custom body), align })
   * Items marked `on` show a tick (multi: a checkbox). A non-multi pick closes it first. Arrow keys, Enter and Esc work from the keyboard.
   */
  function pop(anchor, o) {
    closePop();
    const el = document.createElement('div'); el.className = `tv-pop ${o.cls || ''}`; el.setAttribute('role', 'menu');
    let q = '', hi = 0;
    const visible = () => (o.items || []).filter((i) => !q || (i.text || i.html.replace(/<[^>]+>/g, '')).toLowerCase().includes(q.toLowerCase()));
    const drawItems = () => {
      const vis = visible(); if (hi >= vis.length) hi = Math.max(0, vis.length - 1);
      el.querySelector('.pop-l').innerHTML = vis.length ? vis.map((i, n) => `<button type="button" class="pop-i${i.on ? ' on' : ''}${n === hi ? ' hi' : ''}" data-id="${esc(i.id)}">${o.multi ? `<span class="pop-ck">${i.on ? '✓' : ''}</span>` : ''}${i.html}${!o.multi && i.on ? '<span class="pop-tick">✓</span>' : ''}</button>`).join('') : '<div class="pop-e">No matches</div>';
    };
    if (o.draw) { o.draw(el, closePop); } else {
      el.innerHTML = `${o.title ? `<div class="pop-t">${esc(o.title)}</div>` : ''}${o.search ? `<input class="pop-s" placeholder="${esc(o.search)}" aria-label="${esc(o.search)}" autocomplete="off">` : ''}<div class="pop-l"></div>${o.footer ? `<div class="pop-f">${o.footer}</div>` : ''}`;
      drawItems();
      const s = el.querySelector('.pop-s'); if (s) s.addEventListener('input', () => { q = s.value; hi = 0; drawItems(); });
      el.addEventListener('click', (e) => {
        const b = e.target.closest('.pop-i'); if (!b) return;
        const item = o.items.find((i) => String(i.id) === b.dataset.id);
        if (o.multi) { item.on = !item.on; drawItems(); o.onPick(item.id, item); } else { closePop(); o.onPick(item.id, item); }
      });
      if (o.footer && o.onFooter) o.onFooter(el, closePop);
    }
    document.body.appendChild(el);
    const r = anchor.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
    let left = o.align === 'right' ? r.right - w : r.left; left = Math.max(8, Math.min(left, innerWidth - w - 8));
    let top = r.bottom + 4; if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 4);
    el.style.left = `${left}px`; el.style.top = `${top}px`;
    const away = (e) => { if (!el.contains(e.target) && !anchor.contains(e.target)) closePop(); };
    const key = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); closePop(); return; }
      if (o.draw) return;
      const vis = visible();
      if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(vis.length - 1, hi + 1); drawItems(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(0, hi - 1); drawItems(); }
      else if (e.key === 'Enter' && vis[hi]) { e.preventDefault(); el.querySelectorAll('.pop-i')[hi]?.click(); }
      else if (/^[1-9]$/.test(e.key) && !o.search) { const b = el.querySelectorAll('.pop-i')[+e.key - 1]; if (b) { e.preventDefault(); b.click(); } }
    };
    setTimeout(() => { if (openPop && openPop.el === el) document.addEventListener('mousedown', away, true); }, 0); // not if it was closed already
    document.addEventListener('keydown', key, true);
    openPop = { el, away, key, onClose: o.onClose };
    const s = el.querySelector('.pop-s'); if (s) s.focus();
    return el;
  }

  /* ---------- the Ctrl+K command menu ---------- */
  async function palette({ ctx, commands = [], tasks = [], openTask }) {
    if (document.getElementById('tv-pal')) return;
    let projects = [];
    try { projects = await Store.projects(ctx.portal.id); } catch (err) { /* only the commands */ }
    const slug = ctx.slug, go = (u) => () => Router.navigate(u);
    const base = [...commands, { label: 'Go to My tasks', run: go(`/p/${slug}/tasks`) }, { label: 'Go to All tasks', run: go(`/p/${slug}/tasks?tab=all`) }, { label: 'Go to Projects', run: go(`/p/${slug}/projects`) },
      ...projects.map((p) => ({ label: `Go to ${p.name}`, run: go(`/p/${slug}/projects/${p.id}/tasks`) }))];
    const host = document.createElement('div'); host.className = 'tv-scrim'; host.id = 'tv-pal'; document.body.appendChild(host);
    let q = '', hi = 0, list = [];
    const close = () => { host.remove(); document.removeEventListener('keydown', onKey, true); };
    const draw = () => {
      const ql = q.trim().toLowerCase();
      const cmds = base.filter((c) => !ql || c.label.toLowerCase().includes(ql));
      const found = ql ? tasks.filter((t) => `${t.key} ${t.title}`.toLowerCase().includes(ql)).slice(0, 6).map((t) => ({ label: `${t.key}  ${t.title}`, t, run: () => openTask(t) })) : [];
      list = [...cmds, ...found]; if (hi >= list.length) hi = Math.max(0, list.length - 1);
      host.querySelector('.res').innerHTML = list.length ? list.map((r, i) => `${i === 0 ? '<div class="gl">Commands</div>' : ''}${i === cmds.length && found.length ? '<div class="gl">Tasks</div>' : ''}<button type="button" class="${i === hi ? 'hi' : ''}" data-i="${i}">${r.t ? statusIcon(r.t.status) : ''}${esc(r.label)}</button>`).join('') : '<div class="pop-e">No results</div>';
    };
    host.innerHTML = '<div class="tv-pal" role="dialog" aria-label="Command menu"><input id="tv-palq" placeholder="Type a command or search tasks…" aria-label="Command" autocomplete="off"><div class="res"></div></div>';
    const run = (i) => { const r = list[i]; if (!r) return; close(); r.run(); };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(0, Math.min(list.length - 1, hi + (e.key === 'ArrowDown' ? 1 : -1))); draw(); }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); run(hi); }
    };
    document.addEventListener('keydown', onKey, true);
    host.addEventListener('click', (e) => { if (e.target === host) return close(); const b = e.target.closest('[data-i]'); if (b) run(+b.dataset.i); });
    const inp = host.querySelector('#tv-palq'); inp.addEventListener('input', () => { q = inp.value; hi = 0; draw(); });
    draw(); inp.focus();
  }

  /* ======================= the engine ======================= */
  /**
   * opts: { ctx, key (storage + defaults), portal: bool, defaultGroup, groups: [ids], state (kept by the host between mounts),
   *         load() -> { tasks, projects:[{id,key,name,canCreate,canEdit,statuses}], lists, people, today },
   *         extra() -> html for the toolbar, wire(el, engine), from ('tasks'|'tasks-all'|''), mine (bool: new tasks are owned by me),
   *         lockedProject (project tab: the project id), emptyHint, onData(D) }
   */
  function mount(host, opts) {
    const ctx = opts.ctx, portalId = ctx.portal.id;
    const STORE_KEY = `py-tv-${opts.key}`;
    const st = opts.state || (opts.state = {});
    if (!st.init) {
      let saved = {}; try { saved = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { /* not remembered */ }
      Object.assign(st, { init: true, view: 'list', group: opts.defaultGroup || 'status', showSub: !!opts.portal, fold: {}, f: { q: '', status: [], owner: [], priority: [], project: [], tag: [] }, showArchived: false, showClosed: false }, saved);
    }
    const f = st.f;
    const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify({ view: st.view, group: st.group, showSub: st.showSub, fold: st.fold })); } catch (e) { /* not remembered */ } };
    const r = { D: null, error: null, notice: opts.notice || null, focus: null, checked: new Set(), qa: null, qaProject: null, order: [], peek: null, peekHost: null, dead: false, drag: null };
    const $ = (sel, root = host) => root.querySelector(sel);

    /* ----- data ----- */
    const normalize = (raw) => {
      const projects = Object.fromEntries(raw.projects.map((p) => [p.id, p]));
      const listName = Object.fromEntries((raw.lists || []).map((l) => [l.id, l.name]));
      const tasks = raw.tasks.map((t) => ({ ...t, projectId: t.projectId || opts.lockedProject, projectName: t.projectName || raw.projects[0]?.name || '', listName: t.listName ?? listName[t.listId] ?? '' }));
      return { tasks, projects, projectList: raw.projects, lists: raw.lists || [], people: raw.people || [], today: raw.today || isoDay(0) };
    };
    const refresh = async () => {
      try { r.D = normalize(await opts.load()); r.error = null; opts.onData?.(r.D); } catch (err) { r.error = err.message; }
      [...r.checked].forEach((id) => { if (!r.D?.tasks.some((t) => t.id === id)) r.checked.delete(id); });
      paint();
    };
    const byId = (id) => r.D?.tasks.find((t) => t.id === id);
    const canCreateAny = () => !!r.D && r.D.projectList.some((p) => p.canCreate);
    const canEdit = (t) => !!r.D?.projects[t.projectId]?.canEdit;

    /* ----- filtering and grouping ----- */
    const filtered = () => !!(f.q.trim() || f.status.length || f.owner.length || f.priority.length || f.project.length || f.tag.length);
    const archivedListIds = () => new Set(r.D.lists.filter((l) => l.archived).map((l) => l.id));
    const visibleTasks = () => {
      const q = f.q.trim().toLowerCase(), arch = archivedListIds(), fl = filtered();
      return r.D.tasks.filter((t) => {
        if (!st.showArchived && arch.has(t.listId)) return false;
        if (opts.mine && !st.showClosed && t.closed) return false;
        if (!(st.showSub || fl) && t.parentId) return false;
        if (f.status.length && !f.status.includes(t.status.name.toLowerCase())) return false;
        if (f.priority.length && !f.priority.includes(t.priority)) return false;
        if (f.owner.length && !(t.ownerIds.length ? t.ownerIds.some((o) => f.owner.includes(o)) : f.owner.includes('none'))) return false;
        if (f.project.length && !f.project.includes(t.projectId)) return false;
        if (f.tag.length && !t.tags.some((x) => f.tag.includes(x))) return false;
        if (q && !(t.title.toLowerCase().includes(q) || t.key.toLowerCase().includes(q) || t.tags.some((x) => x.toLowerCase().includes(q)))) return false;
        return true;
      });
    };
    const statusGroups = () => {
      const map = new Map();
      r.D.projectList.forEach((p) => p.statuses.forEach((x) => { const k = x.name.toLowerCase(); if (!map.has(k)) map.set(k, { id: k, label: x.name, st: x }); }));
      const arr = [...map.values()];
      return r.D.projectList.length === 1 ? arr : [...arr.filter((g) => g.st.type !== 'CLOSED'), ...arr.filter((g) => g.st.type === 'CLOSED')];
    };
    const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
    const dueBucket = (t) => {
      const today = r.D.today;
      if (!t.dueDate) return 'none';
      if (t.dueDate < today) return t.closed ? 'earlier' : 'overdue';
      if (t.dueDate === today) return 'today';
      return t.dueDate <= addDays(today, 7) ? 'week' : 'later';
    };
    const groupKey = () => st.group;
    const boardKey = () => (['none', 'due'].includes(st.group) ? 'status' : st.group);
    function buildGroups(tasks, key) {
      const mk = (id, label, extra) => ({ id, label, items: [], ...extra });
      let gs;
      if (key === 'status') gs = statusGroups().map((g) => mk(g.id, g.label, { st: g.st }));
      else if (key === 'priority') gs = PRIO_ORDER.map((p) => mk(p, p === 'NONE' ? 'No priority' : PRIO[p], { prio: p }));
      else if (key === 'owner') gs = [...r.D.people.map((p) => mk(p.userId, p.fullName, { person: p.fullName })), mk('none', 'Unassigned', { person: null })];
      else if (key === 'list') gs = opts.portal ? [] : r.D.lists.filter((l) => st.showArchived || !l.archived).map((l) => mk(l.id, l.name, { list: l }));
      else if (key === 'due') gs = [['overdue', 'Overdue'], ['today', 'Today'], ['week', 'This week'], ['later', 'Later'], ['none', 'No due date'], ['earlier', 'Earlier (closed)']].map(([id, label]) => mk(id, label));
      else gs = [mk('all', 'All tasks')];
      const idOf = (t) => (key === 'status' ? t.status.name.toLowerCase() : key === 'priority' ? t.priority : key === 'owner' ? (t.ownerIds[0] || 'none') : key === 'list' ? (opts.portal ? `${t.projectId}:${t.listId}` : t.listId) : key === 'due' ? dueBucket(t) : 'all');
      tasks.forEach((t) => {
        const id = idOf(t); let g = gs.find((x) => x.id === id);
        if (!g) { g = mk(id, key === 'owner' ? (t.owners[0]?.name || 'Unassigned') : key === 'list' ? `${t.projectName} / ${t.listName}` : id, { person: key === 'owner' ? t.owners[0]?.name : undefined }); gs.push(g); }
        g.items.push(t);
      });
      if (key === 'list' && opts.portal) gs.sort((a, b) => a.label.localeCompare(b.label));
      return (key === 'status' || key === 'list') && !filtered() && !opts.portal ? gs : gs.filter((g) => g.items.length);
    }
    const groupIcon = (g, key) => (key === 'status' ? statusIcon(g.st) : key === 'priority' ? prioIcon(g.prio) : key === 'owner' ? avatar(g.person, 16) : key === 'list' ? `<span class="tdot">${ic('stack', 11)}</span>` : '');

    /* ----- rendering ----- */
    const chipDefs = () => [['status', 'Status', (v) => statusGroups().find((g) => g.id === v)?.label || v], ['priority', 'Priority', (v) => (v === 'NONE' ? 'No priority' : PRIO[v])],
      ['owner', 'Owner', (v) => (v === 'none' ? 'Unassigned' : r.D.people.find((p) => p.userId === v)?.fullName || v)], ...(opts.portal ? [['project', 'Project', (v) => r.D.projects[v]?.name || v]] : []), ['tag', 'Tag', (v) => v]];
    const chipsHtml = () => {
      const chips = [...(f.q.trim() ? [`<span class="fc" data-chip="q"><span class="m">Search</span> is <b>${esc(f.q.trim())}</b><button type="button" class="ibtn" data-clearf="q" aria-label="Remove search">${ic('x', 10)}</button></span>`] : []), ...chipDefs().filter(([k]) => f[k].length).map(([k, label, nm]) => `<span class="fc" data-chip="${k}"><span class="m">${label}</span> is <b>${f[k].map((v) => esc(nm(v))).join(', ')}</b><button type="button" class="ibtn" data-clearf="${k}" aria-label="Remove ${label} filter">${ic('x', 10)}</button></span>`)];
      return chips.length ? `<div class="fbar" id="tv-chips">${chips.join('')}<button class="fc add" type="button" data-act="filter">${ic('plus', 11)}Filter</button><button class="fc add" type="button" id="f-clear">Clear filters</button></div>` : '';
    };
    const dueBtn = (t) => `<button type="button" class="due${t.overdue ? ' over' : ''}${t.dueDate ? '' : ' none'}" data-pick="due" title="${t.dueDate ? (t.overdue ? 'Overdue' : 'Due date') : 'Set a due date'} (D)" aria-label="Due date">${t.dueDate ? esc(day(t.dueDate, ctx)) : ic('cal', 13)}</button>`;
    const hrefOf = (t) => `#/p/${ctx.slug}/projects/${t.projectId}/tasks/${t.id}${opts.from ? `?from=${opts.from}` : ''}`;
    const labels = (t, n = 2) => t.tags.slice(0, n).map((x) => `<span class="tag">${esc(x)}</span>`).join('');
    const subBadge = (t) => (t.subtaskCount ? `<span class="subc" title="${t.subtasksDone} of ${t.subtaskCount} subtasks closed">${ic('sub', 11)}${t.subtasksDone}/${t.subtaskCount}</span>` : '');
    const rowHtml = (t) => {
      const on = r.checked.has(t.id);
      return `<div class="trow${t.closed ? ' done' : ''}${t.parentId ? ' sub' : ''}${r.focus === t.id ? ' focus' : ''}${on ? ' checked' : ''}" data-open="${esc(t.id)}" data-pid="${esc(t.projectId)}" role="row" aria-label="${esc(t.key)} ${esc(t.title)}">
        <span class="pc"><button type="button" class="pb" data-pick="priority" title="Priority: ${esc(PRIO[t.priority])} (P)" aria-label="Priority: ${esc(PRIO[t.priority])}">${prioIcon(t.priority)}</button><button type="button" class="chk" data-check="${esc(t.id)}" aria-label="Select ${esc(t.key)}" aria-pressed="${on}"><span class="cbx">${on ? '✓' : ''}</span></button></span>
        <span class="c-key mono">${esc(t.key)}</span>
        <button type="button" class="si" data-pick="status" title="Status: ${esc(t.status.name)} (S)" aria-label="Status: ${esc(t.status.name)}">${statusIcon(t.status)}</button>
        <span class="c-title">${t.parentId ? `<span class="subi" title="Subtask">${ic('sub', 12)}</span>` : ''}<a class="tt" href="${hrefOf(t)}">${esc(t.title)}</a>${subBadge(t)}${labels(t)}</span>
        <span class="hint">${kbd('S')}${kbd('P')}${kbd('A')}</span>
        ${opts.portal ? `<span class="c-pj" title="${esc(t.projectName)}">${esc(t.projectName)}</span>` : ''}
        <button type="button" class="asg" data-pick="owner" title="Owners: ${esc(t.owners.map((o) => o.name).join(', ') || 'none')} (A)" aria-label="Owners">${ownerStack(t.owners)}</button>
        <span class="c-due">${dueBtn(t)}</span></div>`;
    };
    const cardHtml = (t) => `<article class="card${t.closed ? ' done' : ''}${r.focus === t.id ? ' focus' : ''}" draggable="${canEdit(t)}" data-card="${esc(t.id)}" data-open="${esc(t.id)}" data-pid="${esc(t.projectId)}" aria-label="${esc(t.key)} ${esc(t.title)}">
        <div class="t1"><span class="mono">${esc(t.key)}</span>${opts.portal ? `<span class="c-pj">${esc(t.projectName)}</span>` : ''}<span class="sp"></span><button type="button" class="asg" data-pick="owner" aria-label="Owners" title="Owners (A)">${ownerStack(t.owners, 20)}</button></div>
        <a class="ct" href="${hrefOf(t)}">${esc(t.title)}</a>
        <div class="t2"><button type="button" class="si" data-pick="priority" aria-label="Priority: ${esc(PRIO[t.priority])}" title="Priority: ${esc(PRIO[t.priority])} (P)">${prioIcon(t.priority)}</button>${subBadge(t)}${labels(t, 1)}<span class="sp"></span>${dueBtn(t)}</div></article>`;
    const qaHtml = (gid) => {
      if (!r.qa || r.qa.gid !== gid) return '';
      const projs = r.D.projectList.filter((p) => p.canCreate);
      return `<form class="qadd" data-add="${esc(gid)}" novalidate><span class="plus" aria-hidden="true">${ic('plus', 13)}</span>${opts.portal ? `<select class="py-select" name="projectId" aria-label="Project">${projs.map((p) => `<option value="${esc(p.id)}"${p.id === r.qaProject ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select>` : ''}<input type="text" name="title" placeholder="Task title, then Enter" aria-label="Add a task" maxlength="${Store.TITLE_MAX}" autocomplete="off">${r.qa.err ? `<p class="py-field__error">${icon('alert')}${esc(r.qa.err)}</p>` : ''}</form>`;
    };
    const groupHead = (g, key, shut) => `<div class="gh${shut ? ' fold' : ''}" data-group-id="${esc(g.id)}" data-gkey="${key}">
        <button type="button" class="gtoggle" data-fold="${esc(`${key}:${g.id}`)}" aria-expanded="${!shut}" aria-label="${shut ? 'Expand' : 'Collapse'} ${esc(g.label)}"><span class="car">${ic('car', 12)}</span></button>
        ${groupIcon(g, key)}<span class="gname">${esc(g.label)}</span><span class="gcount cnt">${g.items.length}</span>
        ${g.list ? `${g.list.isDefault ? '<span class="chip">Default</span>' : ''}${g.list.flag === 'EXTERNAL' ? '<span class="chip">External</span>' : ''}${g.list.archived ? '<span class="chip">Archived</span>' : ''}` : ''}
        <span class="sp"></span>${canCreateAny() && !(g.list && g.list.archived) ? `<button type="button" class="ibtn gplus" data-qa="${esc(g.id)}" aria-label="Add a task to ${esc(g.label)}" title="Add a task">${ic('plus')}</button>` : ''}</div>`;
    const listHtml = (tasks) => {
      r.order = []; const key = groupKey();
      const gs = buildGroups(tasks, key);
      return `<div class="tlist" id="tv-list">${gs.map((g) => {
        const fk = `${key}:${g.id}`, shut = !!st.fold[fk];
        if (!shut) g.items.forEach((t) => r.order.push(t.id));
        return `<section class="tgroup${g.list?.archived ? ' archived' : ''}" data-group="${esc(g.id)}" data-list="${esc(g.list?.id || '')}" aria-label="${esc(g.label)}">${groupHead(g, key, shut)}${shut ? '' : `${g.items.map(rowHtml).join('')}${!g.items.length ? `<div class="tempty">${filtered() ? 'No tasks match the filters.' : 'No tasks here yet.'}</div>` : ''}${qaHtml(g.id)}`}</section>`;
      }).join('')}${canCreateAny() ? `<button type="button" class="qrow" data-act="new">${ic('plus')}New task ${kbd('C')}</button>` : ''}</div>`;
    };
    const boardHtml = (tasks) => {
      r.order = []; const key = boardKey();
      const gs = buildGroups(tasks, key);
      return `<div class="board" id="tv-board">${gs.map((g) => {
        g.items.forEach((t) => r.order.push(t.id));
        return `<section class="col" data-col="${esc(g.id)}" aria-label="${esc(g.label)}"><h3>${groupIcon(g, key)}<span class="gname">${esc(g.label)}</span><span class="cnt gcount">${g.items.length}</span><span class="sp"></span>${canCreateAny() ? `<button type="button" class="ibtn" data-qa="${esc(g.id)}" aria-label="Add a task to ${esc(g.label)}" title="Add a task">${ic('plus')}</button>` : ''}</h3>
          <div class="cards">${qaHtml(g.id)}${g.items.map(cardHtml).join('')}${g.items.length ? '' : '<div class="colempty">No tasks</div>'}</div></section>`;
      }).join('')}</div>`;
    };
    const bodyHtml = () => {
      if (r.error) return `<div class="py-alert" role="alert">${icon('alert')}<span>${esc(r.error)}</span></div>`;
      if (!r.D) return '<p class="py-caption" style="padding:16px">Loading tasks…</p>';
      const tasks = visibleTasks();
      if (!tasks.length) { r.order = []; return `<div class="empty">${ic('stack', 34)}<b>${filtered() ? 'No tasks match the filters.' : (opts.emptyHint || 'No tasks yet.')}</b>${filtered() ? '<button class="tb" type="button" data-clearall style="margin-top:8px">Clear filters</button>' : ''}</div>`; }
      return st.view === 'board' ? boardHtml(tasks) : listHtml(tasks);
    };
    const bulkHtml = () => (r.checked.size ? `<div class="selbar" role="toolbar" aria-label="Bulk actions"><b>${r.checked.size} selected</b><button class="tb" type="button" data-bulk="status">Status</button><button class="tb" type="button" data-bulk="owner">Owner</button><button class="tb" type="button" data-bulk="priority">Priority</button><button class="ibtn" type="button" data-bulk="clear" aria-label="Clear selection">${ic('x')}</button></div>` : '');
    const hintsHtml = () => `<div class="hints">${st.view === 'board' ? '<span>Drag cards between columns to change them</span>' : `<span>${kbd('J')}${kbd('K')} move</span><span>${kbd('Space')} peek</span><span>${kbd('Enter')} open</span><span>${kbd('S')} status</span><span>${kbd('P')} priority</span><span>${kbd('A')} owner</span><span>${kbd('X')} select</span>`}<span>${kbd('C')} new task</span><span>${kbd('Ctrl')}${kbd('K')} commands</span></div>`;
    const barHtml = () => `<div class="tv-bar" role="toolbar" aria-label="Task view">
        <button class="tb" type="button" data-act="filter">${ic('filter')}Filter</button>
        <div class="tsearch"><span aria-hidden="true">${ic('search', 13)}</span><input type="search" id="f-q" placeholder="Search tasks" aria-label="Search tasks" value="${esc(f.q)}" autocomplete="off"></div>
        <span class="sp"></span>${opts.extra ? opts.extra() : ''}
        <button class="tb" type="button" data-act="display" id="display-btn" aria-haspopup="true">${ic('disp')}Display</button>
        ${canCreateAny() ? `<button class="tb pri" type="button" id="new-task" data-act="new">${ic('plus')}New task</button>` : ''}</div>`;
    const noticeHtml = () => (r.notice ? `<div class="py-alert py-alert--ok" role="status" id="notice">${icon('check')}<span>${esc(r.notice)}</span></div>` : '');
    function paint() {
      if (r.dead) return;
      host.innerHTML = `<div class="tv${st.view === 'board' ? ' is-board' : ''}">${barHtml()}<div id="tv-chips-host">${r.D ? chipsHtml() : ''}</div><div id="tv-notice">${noticeHtml()}</div><div class="tv-body" id="tv-body">${bodyHtml()}</div><div id="tv-bulk">${bulkHtml()}</div>${hintsHtml()}</div>`;
      opts.wire?.(host, api);
      afterBody();
    }
    function paintBody() {
      if (!r.D) return paint();
      $('#tv-chips-host').innerHTML = chipsHtml(); $('#tv-body').innerHTML = bodyHtml(); $('#tv-bulk').innerHTML = bulkHtml(); $('#tv-notice').innerHTML = noticeHtml();
      host.querySelector('.tv').classList.toggle('is-board', st.view === 'board');
      afterBody();
    }
    function afterBody() {
      if (r.qa) { const i = $(`[data-add="${CSS.escape(r.qa.gid)}"] input`); if (i) { i.value = r.qa.text || ''; if (!r.qa.noFocus) i.focus(); } }
    }
    const setNotice = (m) => { r.notice = m; const n = $('#tv-notice'); if (n) n.innerHTML = noticeHtml(); };

    /* ----- mutations ----- */
    const need = (t) => { if (!canEdit(t)) { toast('You can read this task, but only project members can change it.'); return false; } return true; };
    const statusFor = (t, key) => r.D.projects[t.projectId]?.statuses.find((x) => x.name.toLowerCase() === key);
    const ask = (title, lead, label) => new Promise((res) => { let ok = false; Tasks.ui.formDialog({ title, lead, label, onSubmit: async () => { ok = true; }, onClose: () => res(ok) }); });
    /** Runs fn(task, confirm) for each task; open-subtask closes are collected and confirmed once. Always refreshes. */
    async function applyMany(ts, fn) {
      const fails = [];
      for (const t of ts) { try { await fn(t, false); } catch (err) { fails.push([t, err]); } }
      const open = fails.filter(([, e]) => e.code === 'OPEN_SUBTASKS'), other = fails.filter(([, e]) => e.code !== 'OPEN_SUBTASKS');
      if (open.length) {
        const ok = await ask(open.length === 1 ? `Close ${open[0][0].key}?` : `Close ${open.length} tasks?`, open.length === 1 ? esc(open[0][1].message) : 'Some of these tasks still have open subtasks. The subtasks stay open if you close them.', 'Close anyway');
        if (ok) for (const [t] of open) { try { await fn(t, true); } catch (err) { other.push([t, err]); } }
      }
      if (other.length) toast(other[0][1].message + (other.length > 1 ? ` (${other.length} failed)` : ''));
      await refresh();
    }
    const setStatusOf = (key) => (t, confirm) => { const x = statusFor(t, key); if (!x) throw new Error(`${t.projectName} has no "${key}" status.`); return Store.setTaskStatus(portalId, t.id, x.id, confirm ? { confirm: true } : undefined); };
    const patchOf = (patch) => (t) => Store.updateTask(portalId, t.id, patch);
    async function moveTo(id, key, gid) {
      const t = byId(id); if (!t || !need(t)) return;
      if (key === 'status') { if (t.status.name.toLowerCase() === gid) return; return applyMany([t], setStatusOf(gid)); }
      if (key === 'priority') return t.priority === gid ? null : applyMany([t], patchOf({ priority: gid }));
      if (key === 'owner') return applyMany([t], patchOf({ ownerIds: gid === 'none' ? [] : [gid] }));
      if (key === 'list') { if (t.parentId) return toast("A subtask stays in its parent's list."); return applyMany([t], patchOf({ listId: gid })); }
    }

    /* ----- pickers ----- */
    const num = (i) => `<span class="kbd num">${i + 1}</span>`;
    function statusItems(ts) {
      const seen = new Map();
      ts.forEach((t) => (r.D.projects[t.projectId]?.statuses || []).forEach((x) => { const k = x.name.toLowerCase(); if (!seen.has(k)) seen.set(k, x); }));
      const cur = ts.length === 1 ? ts[0].status.name.toLowerCase() : null;
      return [...seen.entries()].map(([k, x], i) => ({ id: k, on: k === cur, html: `${statusIcon(x)}${esc(x.name)}${num(i)}`, text: x.name }));
    }
    function pick(kind, ids, anchor) {
      const ts = ids.map(byId).filter(Boolean); if (!ts.length || !ts.every(need)) return;
      const one = ts.length === 1 ? ts[0] : null;
      if (kind === 'status') return pop(anchor, { search: 'Change status…', items: statusItems(ts), onPick: (k) => applyMany(ts, setStatusOf(k)) });
      if (kind === 'priority') return pop(anchor, { search: 'Set priority…', items: PRIO_ORDER.map((p, i) => ({ id: p, on: one?.priority === p, html: `${prioIcon(p)}${p === 'NONE' ? 'No priority' : esc(PRIO[p])}${num(i)}`, text: PRIO[p] })), onPick: (p) => applyMany(ts, patchOf({ priority: p })) });
      if (kind === 'owner') {
        const people = r.D.people;
        if (one) {
          const items = people.map((p) => ({ id: p.userId, on: one.ownerIds.includes(p.userId), html: `${avatar(p.fullName, 18)}${esc(p.fullName)}${p.userId === ctx.me.id ? '<span class="you">You</span>' : ''}`, text: p.fullName }));
          return pop(anchor, { search: 'Assign to…', multi: true, items, onPick: () => applyMany([one], patchOf({ ownerIds: items.filter((i) => i.on).map((i) => i.id) })) });
        }
        return pop(anchor, { search: 'Assign all to…', items: [{ id: 'none', html: `${avatar(null, 18)}No owner`, text: 'No owner' }, ...people.map((p) => ({ id: p.userId, html: `${avatar(p.fullName, 18)}${esc(p.fullName)}`, text: p.fullName }))], onPick: (v) => applyMany(ts, patchOf({ ownerIds: v === 'none' ? [] : [v] })) });
      }
      if (kind === 'due') {
        const opts2 = [['Today', isoDay(0)], ['Tomorrow', isoDay(1)], ['In a week', isoDay(7)], ['In two weeks', isoDay(14)], ['No due date', null]];
        return pop(anchor, { title: 'Due date', items: opts2.map(([l, v], i) => ({ id: i, on: one?.dueDate === v && v !== null, html: `${ic('cal')}${l}${v ? `<span class="pop-hint">${esc(day(v, ctx))}</span>` : ''}`, text: l })), onPick: (i) => applyMany(ts, patchOf({ dueDate: opts2[i][1] })),
          footer: '<input type="date" class="pop-date" aria-label="Pick a date">', onFooter: (el, close) => el.querySelector('.pop-date').addEventListener('change', (e) => { if (e.target.value) { close(); applyMany(ts, patchOf({ dueDate: e.target.value })); } }) });
      }
    }
    const targets = () => (r.checked.size ? [...r.checked] : r.focus ? [r.focus] : []);
    const anchorFor = (kind, id) => host.querySelector(`[data-open="${CSS.escape(id)}"] [data-pick="${kind}"]`) || host.querySelector('#display-btn') || host;

    /* ----- filter menu and display popover ----- */
    function filterMenu(anchor) {
      const cats = chipDefs();
      pop(anchor, { title: 'Filter', items: cats.map(([k, label]) => ({ id: k, html: label, text: label })), onPick: (k) => setTimeout(() => {
        const label = cats.find((c) => c[0] === k)[1];
        const items = k === 'status' ? statusGroups().map((g) => ({ id: g.id, html: `${statusIcon(g.st)}${esc(g.label)}`, text: g.label }))
          : k === 'priority' ? PRIO_ORDER.map((p) => ({ id: p, html: `${prioIcon(p)}${p === 'NONE' ? 'No priority' : esc(PRIO[p])}`, text: PRIO[p] }))
          : k === 'owner' ? [...r.D.people.map((p) => ({ id: p.userId, html: `${avatar(p.fullName, 18)}${esc(p.fullName)}`, text: p.fullName })), { id: 'none', html: `${avatar(null, 18)}Unassigned`, text: 'Unassigned' }]
          : k === 'project' ? r.D.projectList.map((p) => ({ id: p.id, html: esc(p.name), text: p.name }))
          : [...new Set(r.D.tasks.flatMap((t) => t.tags))].sort().map((x) => ({ id: x, html: `<span class="tag">${esc(x)}</span>`, text: x }));
        items.forEach((i) => { i.on = f[k].includes(i.id); });
        pop(anchor, { multi: true, search: `${label}…`, items, onPick: (v, it) => { if (it.on) f[k].push(v); else f[k].splice(f[k].indexOf(v), 1); paintBody(); } });
      }, 0) });
    }
    function displayMenu(anchor) {
      const groups = GROUPS.filter(([id]) => (opts.groups || GROUPS.map((g) => g[0])).includes(id));
      pop(anchor, { cls: 'disp', align: 'right', draw: (el) => {
        const draw = () => {
          el.innerHTML = `<div class="pop-t">View</div><div class="seg"><button type="button" data-dv="list" class="${st.view !== 'board' ? 'on' : ''}">${ic('list')}List</button><button type="button" data-dv="board" class="${st.view === 'board' ? 'on' : ''}">${ic('board')}Board</button></div>
            <div class="pop-t">Grouping</div>${groups.map(([id, l]) => `<button type="button" class="di${st.group === id ? ' on' : ''}" data-dg="${id}">${l}${st.group === id ? '<span class="pop-tick">✓</span>' : ''}</button>`).join('')}
            <div class="pop-t">Show</div>
            <label class="di"><input type="checkbox" id="show-sub" ${st.showSub ? 'checked' : ''}><span>Subtasks</span></label>
            ${!opts.portal && r.D?.lists.some((l) => l.archived) ? `<label class="di"><input type="checkbox" id="show-archived" ${st.showArchived ? 'checked' : ''}><span>Archived lists</span></label>` : ''}
            ${opts.mine ? `<label class="di"><input type="checkbox" id="show-closed" ${st.showClosed ? 'checked' : ''}><span>Closed tasks</span></label>` : ''}`;
        };
        draw();
        el.addEventListener('click', (e) => {
          const v = e.target.closest('[data-dv]'), g = e.target.closest('[data-dg]');
          if (v) { st.view = v.dataset.dv; save(); paintBody(); draw(); }
          if (g) { st.group = g.dataset.dg; save(); paintBody(); draw(); }
          const cb = e.target.closest('input[type=checkbox]');
          if (cb) { if (cb.id === 'show-sub') st.showSub = cb.checked; if (cb.id === 'show-archived') st.showArchived = cb.checked; if (cb.id === 'show-closed') st.showClosed = cb.checked; save(); paintBody(); }
        });
      } });
    }

    /* ----- quick add and the New task modal ----- */
    function defaultsFor(gid, key) {
      const d = {};
      if (opts.mine) d.ownerIds = [ctx.me.id];
      if (!gid) return d;
      if (key === 'status') d.statusKey = gid; else if (key === 'priority') d.priority = gid;
      else if (key === 'owner') d.ownerIds = gid === 'none' ? [] : [gid];
      else if (key === 'list') { if (opts.portal) { const [pid, lid] = gid.split(':'); d.projectId = pid; d.listId = lid; } else d.listId = gid; }
      else if (key === 'due') { if (gid === 'today') d.dueDate = r.D.today; else if (gid === 'week') d.dueDate = addDays(r.D.today, 3); else if (gid === 'later') d.dueDate = addDays(r.D.today, 14); }
      return d;
    }
    const activeKey = () => (st.view === 'board' ? boardKey() : groupKey());
    async function createFromDefaults(d, title, extra = {}) {
      const projectId = d.projectId || opts.lockedProject || r.D.projectList.find((p) => p.canCreate)?.id;
      const p = r.D.projects[projectId]; if (!p) throw new Error('Pick a project first.');
      const body = { title, ...(d.ownerIds ? { ownerIds: d.ownerIds } : {}), ...(d.priority ? { priority: d.priority } : {}), ...(d.dueDate ? { dueDate: d.dueDate } : {}), ...(d.listId ? { listId: d.listId } : {}), ...extra };
      const sk = d.statusKey && statusFor({ projectId }, d.statusKey); if (sk) body.statusId = sk.id;
      const made = await Store.createTask(portalId, projectId, body);
      return { made, project: p };
    }
    async function submitQuick(form) {
      const gid = r.qa.gid, title = form.title.value; if (!title.trim()) return;
      const d = defaultsFor(gid, activeKey()); if (opts.portal && form.projectId) { d.projectId = form.projectId.value; r.qaProject = d.projectId; delete d.listId; }
      form.title.disabled = true; r.qa.err = null; r.qa.text = '';
      try { await createFromDefaults(d, title); } catch (err) { r.qa.err = err.message; r.qa.text = title; }
      r.qa.noFocus = false; await refresh();
    }
    function openNew(gid = null, key = null) {
      if (!canCreateAny()) return;
      closePop();
      const d = defaultsFor(gid, key || activeKey());
      const projs = r.D.projectList.filter((p) => p.canCreate);
      const m = { projectId: d.projectId || opts.lockedProject || projs[0].id, title: '', desc: '', statusKey: d.statusKey || null, priority: d.priority || 'NONE', ownerIds: d.ownerIds || [], dueDate: d.dueDate || null, listId: d.listId || null, more: false, err: null };
      const el = document.createElement('div'); el.className = 'tv-scrim'; el.id = 'tv-modal'; document.body.appendChild(el);
      const curStatuses = () => r.D.projects[m.projectId].statuses;
      const curStatus = () => curStatuses().find((x) => x.name.toLowerCase() === m.statusKey) || curStatuses().find((x) => x.isDefault) || curStatuses()[0];
      const listsOf = () => r.D.lists.filter((l) => !l.archived && (!opts.portal));
      const close = () => { el.remove(); document.removeEventListener('keydown', onKey, true); };
      const draw = (focus = true) => {
        const ownerNames = m.ownerIds.map((id) => r.D.people.find((p) => p.userId === id)?.fullName).filter(Boolean);
        const lst = listsOf().find((l) => l.id === m.listId) || listsOf().find((l) => l.isDefault);
        el.innerHTML = `<form class="tv-modal" role="dialog" aria-modal="true" aria-label="New task" novalidate>
          <div class="ph">${projs.length > 1 ? `<select class="py-select" id="nt-project" name="projectId" aria-label="Project">${projs.map((p) => `<option value="${esc(p.id)}"${p.id === m.projectId ? ' selected' : ''}>${esc(p.name)} (${esc(p.key)})</option>`).join('')}</select>` : `<b>${esc(r.D.projects[m.projectId].key)}</b>`}<span class="mut">›</span><span>New task</span><span class="sp"></span><button type="button" class="ibtn" data-x aria-label="Close">${ic('x')}</button></div>
          <div class="pbody"><input class="ttl-in" id="nt-title" name="title" maxlength="${Store.TITLE_MAX}" autocomplete="off" placeholder="Task title" aria-label="Title" value="${esc(m.title)}"><textarea class="desc" id="nt-desc" name="desc" placeholder="Add description…" aria-label="Description" rows="3">${esc(m.desc)}</textarea>
            <div class="props"><button type="button" class="pp" data-mp="status">${statusIcon(curStatus())}${esc(curStatus().name)}</button><button type="button" class="pp${m.priority === 'NONE' ? ' mut' : ''}" data-mp="priority">${prioIcon(m.priority)}${m.priority === 'NONE' ? 'Priority' : esc(PRIO[m.priority])}</button>
              <button type="button" class="pp${ownerNames.length ? '' : ' mut'}" data-mp="owner">${ownerNames.length ? avatar(ownerNames[0], 16) : avatar(null, 16)}${ownerNames.length ? esc(ownerNames.join(', ')) : 'Owners'}</button>
              <button type="button" class="pp${m.dueDate ? '' : ' mut'}" data-mp="due">${ic('cal')}${m.dueDate ? esc(day(m.dueDate, ctx)) : 'Due date'}</button>
              ${listsOf().length ? `<button type="button" class="pp" data-mp="list">${ic('stack')}${esc(lst?.name || 'List')}</button>` : ''}</div>
            ${m.err ? `<p class="py-field__error">${icon('alert')}${esc(m.err)}</p>` : ''}</div>
          <div class="pf"><label class="more"><input type="checkbox" id="nt-more" ${m.more ? 'checked' : ''}> Create more</label><button type="button" class="tb" data-x>Cancel</button><button type="submit" class="tb pri" id="nt-create">Create task</button></div></form>`;
        if (focus) el.querySelector('#nt-title').focus();
      };
      const sync = () => { const t = el.querySelector('#nt-title'); if (t) { m.title = t.value; m.desc = el.querySelector('#nt-desc').value; m.more = el.querySelector('#nt-more').checked; } };
      const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.tv-pop')) { e.stopPropagation(); close(); } };
      document.addEventListener('keydown', onKey, true);
      el.addEventListener('click', (e) => {
        if (e.target === el || e.target.closest('[data-x]')) return close();
        const b = e.target.closest('[data-mp]'); if (!b) return;
        sync(); const k = b.dataset.mp, redraw = () => draw();
        if (k === 'status') pop(b, { items: curStatuses().map((x) => ({ id: x.name.toLowerCase(), on: curStatus() === x, html: `${statusIcon(x)}${esc(x.name)}`, text: x.name })), onPick: (v) => { m.statusKey = v; redraw(); } });
        if (k === 'priority') pop(b, { items: PRIO_ORDER.map((p) => ({ id: p, on: m.priority === p, html: `${prioIcon(p)}${p === 'NONE' ? 'No priority' : esc(PRIO[p])}`, text: PRIO[p] })), onPick: (v) => { m.priority = v; redraw(); } });
        if (k === 'owner') { const items = r.D.people.map((p) => ({ id: p.userId, on: m.ownerIds.includes(p.userId), html: `${avatar(p.fullName, 18)}${esc(p.fullName)}`, text: p.fullName })); pop(b, { multi: true, search: 'Assign to…', items, onPick: () => { m.ownerIds = items.filter((i) => i.on).map((i) => i.id); redraw(); } }); }
        if (k === 'due') { const o2 = [['Today', isoDay(0)], ['Tomorrow', isoDay(1)], ['In a week', isoDay(7)], ['No due date', null]]; pop(b, { items: o2.map(([l], i) => ({ id: i, html: `${ic('cal')}${l}`, text: l })), onPick: (i) => { m.dueDate = o2[i][1]; redraw(); } }); }
        if (k === 'list') pop(b, { items: listsOf().map((l) => ({ id: l.id, on: l.id === m.listId, html: `${ic('stack')}${esc(l.name)}`, text: l.name })), onPick: (v) => { m.listId = v; redraw(); } });
      });
      el.addEventListener('change', (e) => { if (e.target.id === 'nt-project') { sync(); m.projectId = e.target.value; m.statusKey = null; m.listId = null; draw(false); } });
      el.addEventListener('submit', async (e) => {
        e.preventDefault(); sync();
        if (!m.title.trim()) { m.err = 'Give the task a title.'; return draw(); }
        const btn = el.querySelector('#nt-create'); btn.disabled = true;
        try {
          const { made, project } = await createFromDefaults({ projectId: m.projectId, statusKey: m.statusKey, priority: m.priority === 'NONE' ? null : m.priority, ownerIds: m.ownerIds, dueDate: m.dueDate, listId: m.listId }, m.title, m.desc.trim() ? { description: m.desc } : {});
          setNotice(`${made.key} created in ${project.name}.`);
          if (m.more) { m.title = ''; m.desc = ''; m.err = null; draw(); } else close();
          await refresh();
        } catch (err) { m.err = err.message; draw(); }
      });
      draw();
    }

    /* ----- peek ----- */
    function openPeek(id) {
      const t = byId(id); if (!t) return;
      r.peek = id; r.focus = id;
      if (!r.peekHost) {
        const h = document.createElement('div'); h.className = 'tv-peek-scrim'; h.id = 'tv-peek';
        h.addEventListener('mousedown', (e) => { if (e.target === h) closePeek(); });
        h.addEventListener('click', (e) => {
          const b = e.target.closest('[data-pk]'); if (!b) return;
          if (b.dataset.pk === 'close') closePeek(); if (b.dataset.pk === 'prev') peekStep(-1); if (b.dataset.pk === 'next') peekStep(1);
          if (b.dataset.pk === 'open') { const x = byId(r.peek); closePeek(true); Router.navigate(hrefOf(x).slice(1)); }
        });
        document.getElementById('app').appendChild(h); r.peekHost = h;
      }
      r.peekHost.innerHTML = `<aside class="tv-peek" role="dialog" aria-label="Task preview"><div class="pk-h"><b class="pk-key">${esc(t.key)}</b><span class="mut">Peek</span><span class="sp"></span><button class="ibtn" type="button" data-pk="prev" aria-label="Previous task" title="Previous (K)">${ic('up')}</button><button class="ibtn" type="button" data-pk="next" aria-label="Next task" title="Next (J)">${ic('down')}</button><button class="ibtn" type="button" data-pk="open" aria-label="Open full page" title="Open full page (Enter)">${ic('expand')}</button><button class="ibtn" type="button" data-pk="close" aria-label="Close preview" title="Close (Esc)">${ic('x')}</button></div><div class="pk-body" id="pk-body"></div></aside>`;
      const pctx = { ...ctx, params: { ...ctx.params, id: t.projectId, tid: t.id }, query: { from: opts.from || '' } };
      Tasks.detail(r.peekHost.querySelector('#pk-body'), pctx, { peek: true, onTrashed: (msg) => { closePeek(); setNotice(msg); }, onOpen: (tid) => openPeek(tid), onClose: () => closePeek() });
      host.querySelectorAll('.focus').forEach((n) => n.classList.remove('focus'));
      host.querySelector(`[data-open="${CSS.escape(id)}"]`)?.classList.add('focus');
    }
    function closePeek(skipRefresh = false) {
      if (!r.peekHost) return;
      r.peekHost.remove(); r.peekHost = null; r.peek = null;
      if (!skipRefresh) refresh();
    }
    function peekStep(d) {
      const i = r.order.indexOf(r.peek), n = r.order[i + d]; if (n) openPeek(n);
    }

    /* ----- events ----- */
    const taskIdOf = (el) => el.closest('[data-open]')?.dataset.open;
    function setFocus(id, scroll = true) {
      r.focus = id; host.querySelectorAll('.focus').forEach((n) => n.classList.remove('focus'));
      const row = id && host.querySelector(`[data-open="${CSS.escape(id)}"]`); if (row) { row.classList.add('focus'); if (scroll) row.scrollIntoView({ block: 'nearest' }); }
    }
    const toggleCheck = (id) => { if (r.checked.has(id)) r.checked.delete(id); else r.checked.add(id); const row = host.querySelector(`[data-open="${CSS.escape(id)}"]`); if (row) { row.classList.toggle('checked', r.checked.has(id)); const b = row.querySelector('.chk'); if (b) { b.setAttribute('aria-pressed', r.checked.has(id)); b.querySelector('.cbx').textContent = r.checked.has(id) ? '✓' : ''; } } $('#tv-bulk').innerHTML = bulkHtml(); };
    host.addEventListener('click', (e) => {
      const T = (sel) => e.target.closest(sel);
      let el;
      if ((el = T('[data-pick]'))) { e.stopPropagation(); const id = taskIdOf(el); setFocus(id, false); const ids = r.checked.has(id) && r.checked.size > 1 ? [...r.checked] : [id]; return pick(el.dataset.pick, ids, el); }
      if ((el = T('[data-check]'))) return toggleCheck(el.dataset.check);
      if ((el = T('[data-fold]'))) { st.fold[el.dataset.fold] = !st.fold[el.dataset.fold]; save(); return paintBody(); }
      if ((el = T('[data-qa]'))) { const gid = el.dataset.qa; r.qa = r.qa && r.qa.gid === gid ? null : { gid, text: '', err: null }; if (!r.qaProject) r.qaProject = r.D.projectList.find((p) => p.canCreate)?.id; return paintBody(); }
      if ((el = T('[data-clearf]'))) { const k = el.dataset.clearf; if (k === 'q') { f.q = ''; const q = $('#f-q'); if (q) q.value = ''; } else f[k] = []; return paintBody(); }
      if ((el = T('[data-bulk]'))) { const k = el.dataset.bulk; if (k === 'clear') { r.checked.clear(); return paintBody(); } return pick(k, [...r.checked], el); }
      if (T('#f-clear, [data-clearall]')) { st.f.q = ''; ['status', 'owner', 'priority', 'project', 'tag'].forEach((k) => { f[k] = []; }); const q = $('#f-q'); if (q) q.value = ''; return paintBody(); }
      if ((el = T('[data-act]'))) {
        const a = el.dataset.act;
        if (a === 'new') return openNew(null, null);
        if (a === 'filter') return filterMenu(el);
        if (a === 'display') return displayMenu(el);
        return;
      }
      if (T('a, button, input, select, textarea, label, form')) return;
      const row = T('[data-open]'); if (row) { setFocus(row.dataset.open, false); openPeek(row.dataset.open); }
    });
    host.addEventListener('input', (e) => { if (e.target.id === 'f-q') { f.q = e.target.value; paintBodyKeepSearch(); } if (e.target.name === 'title' && r.qa) r.qa.text = e.target.value; });
    function paintBodyKeepSearch() { if (!r.D) return; $('#tv-chips-host').innerHTML = chipsHtml(); $('#tv-body').innerHTML = bodyHtml(); $('#tv-bulk').innerHTML = bulkHtml(); afterBody(); }
    host.addEventListener('change', (e) => { if (e.target.name === 'projectId' && r.qa) { r.qaProject = e.target.value; } });
    host.addEventListener('submit', (e) => { const form = e.target.closest('[data-add]'); if (form) { e.preventDefault(); submitQuick(form); } });
    host.addEventListener('keydown', (e) => { if (e.key === 'Escape' && e.target.closest('[data-add]')) { e.stopPropagation(); r.qa = null; paintBody(); } });
    host.addEventListener('focusout', (e) => {
      const form = e.target.closest?.('[data-add]'); if (!form) return;
      setTimeout(() => { if (r.qa && form.isConnected && !form.contains(document.activeElement) && !form.title.value.trim() && !document.querySelector('.tv-pop')) { r.qa = null; paintBody(); } }, 120);
    });
    /* board drag (native HTML5 drag and drop) */
    host.addEventListener('dragstart', (e) => { const c = e.target.closest?.('[data-card]'); if (!c) return; r.drag = c.dataset.card; e.dataTransfer.setData('text/plain', r.drag); e.dataTransfer.effectAllowed = 'move'; setTimeout(() => c.classList.add('dragging'), 0); });
    host.addEventListener('dragend', () => { r.drag = null; host.querySelectorAll('.dragging,.over').forEach((n) => n.classList.remove('dragging', 'over')); });
    host.addEventListener('dragover', (e) => { const col = e.target.closest?.('[data-col]'); if (!col || !r.drag) return; e.preventDefault(); host.querySelectorAll('.over').forEach((n) => n !== col && n.classList.remove('over')); col.classList.add('over'); });
    host.addEventListener('drop', (e) => { const col = e.target.closest?.('[data-col]'); if (!col || !r.drag) return; e.preventDefault(); const id = r.drag; r.drag = null; col.classList.remove('over'); moveTo(id, boardKey(), col.dataset.col); });

    const onKey = (e) => {
      if (!host.isConnected) return api.destroy();
      const t = e.target, typing = /INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); return palette({ ctx, tasks: r.D?.tasks || [], openTask: (x) => openPeek(x.id), commands: paletteCommands() }); }
      if (document.querySelector('.tv-pop, .tv-scrim, .pd-overlay')) return;
      if (e.key === 'Escape') {
        if (typing) { if (!t.closest('#tv-peek')) t.blur(); return; }
        if (r.peek) return closePeek();
        if (r.checked.size) { r.checked.clear(); return paintBody(); }
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey || !r.D) return;
      const k = e.key.toLowerCase();
      if (k === 'c') { e.preventDefault(); return openNew(null, null); }
      if (r.peek) {
        if (k === 'j' || k === 'arrowdown') { e.preventDefault(); return peekStep(1); }
        if (k === 'k' || k === 'arrowup') { e.preventDefault(); return peekStep(-1); }
        if (k === ' ') { e.preventDefault(); return closePeek(); }
        if (k === 'enter') { const x = byId(r.peek); closePeek(true); return Router.navigate(hrefOf(x).slice(1)); }
        return;
      }
      if (st.view === 'board' && !r.order.length) return;
      if (k === 'j' || k === 'arrowdown' || k === 'k' || k === 'arrowup') {
        e.preventDefault(); if (!r.order.length) return;
        const d = k === 'j' || k === 'arrowdown' ? 1 : -1; let i = r.order.indexOf(r.focus);
        i = i < 0 ? (d > 0 ? 0 : r.order.length - 1) : Math.max(0, Math.min(r.order.length - 1, i + d));
        return setFocus(r.order[i]);
      }
      if (k === 'x' && r.focus) { e.preventDefault(); return toggleCheck(r.focus); }
      if (k === ' ' && r.focus) { e.preventDefault(); return openPeek(r.focus); }
      if (k === 'enter' && r.focus) { e.preventDefault(); const x = byId(r.focus); return x && Router.navigate(hrefOf(x).slice(1)); }
      if (['s', 'p', 'a', 'd'].includes(k)) { const ids = targets(); if (!ids.length) return; e.preventDefault(); const kind = { s: 'status', p: 'priority', a: 'owner', d: 'due' }[k]; return pick(kind, ids, anchorFor(kind, ids[0])); }
    };
    document.addEventListener('keydown', onKey);
    const paletteCommands = () => [...(canCreateAny() ? [{ label: 'Create new task', run: () => openNew(null, null) }] : []), { label: 'Switch to list view', run: () => { st.view = 'list'; save(); paintBody(); } }, { label: 'Switch to board view', run: () => { st.view = 'board'; save(); paintBody(); } },
      ...GROUPS.filter(([id]) => (opts.groups || GROUPS.map((g) => g[0])).includes(id)).map(([id, l]) => ({ label: `Group by ${l.toLowerCase()}`, run: () => { st.group = id; save(); paintBody(); } }))];

    const api = { refresh, paint, paintBody, setNotice, state: st, data: () => r.D, toast,
      destroy() { r.dead = true; document.removeEventListener('keydown', onKey); closePop(); r.peekHost?.remove(); r.peekHost = null; } };
    paint(); refresh();
    return api;
  }

  return { mount, palette, pop, closePop, toast, statusIcon, prioIcon, avatar, ownerStack, ic, kbd, day, PRIO_ORDER };
})();
