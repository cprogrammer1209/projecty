/*
 * Shared sample data and helpers for the three Task view explorations (task-zoho / linear / jira .html).
 * In memory only: reload resets it. The pages differ in look and interaction; the data and rules are the same.
 * Project "Website Revamp" (WEB), 3 task lists, 18 tasks, 4 statuses (Open|Closed types), owners, tags, custom fields, comments, activity.
 */
const TM = (() => {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const DAY = 86400000;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const iso = (off) => (off == null ? null : new Date(today.getTime() + off * DAY).toISOString().slice(0, 10));
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtDate = (s) => { if (!s) return ''; const d = new Date(s + 'T00:00:00'); return MON[d.getMonth()] + ' ' + d.getDate(); };
  const fmtLong = (s) => { if (!s) return ''; const d = new Date(s + 'T00:00:00'); return MON[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); };
  const daysFromToday = (s) => Math.round((new Date(s + 'T00:00:00') - today) / DAY);

  const project = { name: 'Website Revamp', key: 'WEB', owner: 'asha' };
  const users = [
    { id: 'asha', name: 'Asha Rao', color: '#7c5cd6' },
    { id: 'dev', name: 'Dev Patel', color: '#1f9d8b' },
    { id: 'maya', name: 'Maya Chen', color: '#e0762b' },
    { id: 'liam', name: 'Liam Ortiz', color: '#3b82d9' },
    { id: 'sofia', name: 'Sofia Rossi', color: '#d6457a' },
    { id: 'noah', name: 'Noah Kim', color: '#7a8a2f' },
  ];
  const ME = 'asha';
  const statuses = [
    { id: 'open', name: 'Open', type: 'Open', color: '#8a94a3' },
    { id: 'progress', name: 'In Progress', type: 'Open', color: '#e8890c' },
    { id: 'review', name: 'In Review', type: 'Open', color: '#8b5cf6' },
    { id: 'closed', name: 'Closed', type: 'Closed', color: '#2f9e6f' },
  ];
  const priorities = [
    { id: 'none', name: 'None', rank: 0 }, { id: 'low', name: 'Low', rank: 1 }, { id: 'medium', name: 'Medium', rank: 2 },
    { id: 'high', name: 'High', rank: 3 }, { id: 'urgent', name: 'Urgent', rank: 4 },
  ];
  const lists = [
    { id: 'design', name: 'Design & Content', phase: 'Phase 1 · Discovery', color: '#7c5cd6' },
    { id: 'dev', name: 'Development', phase: 'Phase 2 · Build', color: '#3b82d9' },
    { id: 'launch', name: 'Launch & QA', phase: 'Phase 3 · Launch', color: '#e0762b' },
  ];
  const tags = ['frontend', 'backend', 'design', 'content', 'seo', 'bug', 'a11y', 'infra'];
  const customFields = [
    { key: 'effort', label: 'Effort (hrs)', type: 'NUMBER' },
    { key: 'visible', label: 'Customer visible', type: 'PICKLIST', options: ['Yes', 'No'] },
  ];

  // [num, title, list, status, priority, owner, dueOffset, tags, subtasks[[title,done,owner]], effort, visible, desc]
  const rows = [
    [1, 'Audit the current site and list pages to keep', 'design', 'closed', 'medium', 'maya', -14, ['content'], [['Crawl the sitemap', 1, 'maya'], ['Tag keep / merge / drop', 1, 'maya']], 12, 'No', 'Walk through every page of the live site and decide what stays. Output is a spreadsheet the content team signs off.'],
    [2, 'Define the new information architecture', 'design', 'closed', 'high', 'asha', -9, ['design', 'content'], [], 8, 'No', 'Navigation tree, URL scheme and redirects for the merged pages.'],
    [3, 'Design the homepage hero and navigation', 'design', 'review', 'high', 'sofia', -2, ['design'], [['Desktop mock-up', 1, 'sofia'], ['Mobile mock-up', 1, 'sofia'], ['Dark footer variant', 0, 'sofia']], 16, 'Yes', 'Hero with a single call to action, sticky navigation, and a mega menu for Products.'],
    [4, 'Write product page copy for the three main plans', 'design', 'progress', 'medium', 'maya', 2, ['content', 'seo'], [['Starter plan', 1, 'maya'], ['Team plan', 0, 'maya'], ['Business plan', 0, 'noah']], 14, 'Yes', 'Plain, benefit-led copy. Keep headlines under 60 characters for search results.'],
    [5, 'Build the design system tokens and components', 'dev', 'progress', 'urgent', 'liam', -3, ['frontend', 'design'], [['Colour and type tokens', 1, 'liam'], ['Button, input, select', 1, 'liam'], ['Card and modal', 0, 'liam'], ['Document in Storybook', 0, 'dev']], 30, 'No', 'The shared component library every page builds on. Blocks the page templates until buttons, forms and cards are done.'],
    [6, 'Set up the CMS and content model', 'dev', 'closed', 'high', 'dev', -6, ['backend'], [['Choose the CMS', 1, 'dev'], ['Model pages and blocks', 1, 'dev']], 20, 'No', 'Headless CMS with page, block and author types. Editors get a preview link per draft.'],
    [7, 'Implement the page templates', 'dev', 'progress', 'high', 'liam', 4, ['frontend'], [['Home', 1, 'liam'], ['Product', 0, 'liam'], ['Pricing', 0, 'liam'], ['Blog post', 0, 'dev']], 36, 'Yes', 'Four templates built on the design system, wired to the CMS content model.'],
    [8, 'Migrate blog posts and set up 301 redirects', 'dev', 'open', 'medium', 'dev', 9, ['backend', 'seo'], [['Export old posts', 0, 'dev'], ['Map old URLs to new', 0, 'dev']], 18, 'No', 'About 240 posts. Every old URL must redirect so search ranking is kept.'],
    [9, 'Add the pricing page calculator', 'dev', 'open', 'low', null, 14, ['frontend'], [], 10, 'Yes', 'Slider for seats, shows monthly and yearly price.'],
    [10, 'Fix layout shift on the mobile navigation', 'dev', 'review', 'high', 'noah', -1, ['frontend', 'bug'], [], 4, 'No', 'The hamburger menu pushes content down on first paint. Reserve the space.'],
    [11, 'Set up image optimisation and a CDN', 'dev', 'progress', 'medium', 'dev', 6, ['infra'], [['Resize on upload', 1, 'dev'], ['Serve WebP', 0, 'dev']], 12, 'No', 'Automatic resizing and modern formats, cached at the edge.'],
    [12, 'Accessibility pass on forms and navigation', 'launch', 'open', 'high', 'sofia', 12, ['a11y'], [['Keyboard walkthrough', 0, 'sofia'], ['Screen reader check', 0, 'sofia'], ['Colour contrast', 0, 'liam']], 16, 'Yes', 'Aim for WCAG 2.2 AA. Log every failure as a sub task.'],
    [13, 'Cross-browser and device test plan', 'launch', 'open', 'medium', 'asha', 16, ['bug'], [], 8, 'No', 'Latest two versions of Chrome, Safari, Firefox and Edge, plus iOS and Android.'],
    [14, 'Performance budget and Lighthouse checks', 'launch', 'open', 'medium', 'asha', 18, ['frontend', 'infra'], [], 10, 'No', 'Largest paint under 2.5 seconds on a mid-range phone.'],
    [15, 'Search and sitemap submission', 'launch', 'open', 'low', 'maya', 21, ['seo'], [], 4, 'No', null],
    [16, 'Stakeholder review and sign-off', 'launch', 'open', 'high', 'asha', 23, ['content'], [['Collect feedback', 0, 'asha'], ['Final approval', 0, 'asha']], 6, 'Yes', 'Walk the leadership team through staging and collect written approval.'],
    [17, 'Launch day runbook and rollback plan', 'launch', 'open', 'urgent', 'dev', 25, ['infra'], [], 6, 'No', 'Step-by-step order of DNS, cache and redirect changes, and how to undo each one.'],
    [18, 'Post-launch monitoring and bug triage', 'launch', 'open', 'none', null, null, [], [], null, null, null],
  ];

  const comments = {
    3: [['sofia', 'Uploaded the desktop and mobile frames. The mobile hero crops the photo at 360px, so I used the portrait crop.', -3], ['asha', 'Looks good. Can the call to action be above the fold on a small phone?', -2], ['sofia', 'Yes, moved it up 40px. Waiting on the dark footer variant.', -2]],
    5: [['liam', 'Tokens and buttons are in. Cards and modals are next, then I will unblock page templates.', -4], ['dev', 'I can take the Storybook docs once the card is done.', -3], ['asha', 'Please post an update by Thursday, the templates depend on this.', -1]],
    7: [['liam', 'Home template is done and wired to the CMS preview.', -2], ['dev', 'Blog post template can start when the content model has the author type.', -1]],
    10: [['noah', 'Reserved the height with a CSS variable. Please review on a real phone.', -1]],
    12: [['sofia', 'Starting once the templates are in staging.', 0]],
  };
  const activity = {
    3: [['sofia', 'moved this to In Review', -2], ['sofia', 'changed Priority from Medium to High', -6], ['asha', 'created this task', -16]],
    5: [['liam', 'changed Due date to ' + fmtDate(iso(-3)), -5], ['liam', 'moved this to In Progress', -10], ['asha', 'assigned this to Liam Ortiz', -12], ['asha', 'created this task', -16]],
    7: [['liam', 'completed sub task "Home"', -2], ['liam', 'moved this to In Progress', -5], ['asha', 'created this task', -16]],
    10: [['noah', 'moved this to In Review', -1], ['asha', 'created this task', -3]],
  };

  const seed = () => rows.map((r, i) => ({
    id: 'WEB-T' + r[0], num: r[0], title: r[1], list: r[2], status: r[3], priority: r[4], owner: r[5], due: iso(r[6]), start: r[6] == null ? null : iso(r[6] - 6),
    tags: r[7], subtasks: r[8].map((s, j) => ({ id: 'WEB-T' + r[0] + '.' + (j + 1), title: s[0], done: !!s[1], owner: s[2] })),
    cf: { effort: r[9], visible: r[10] }, desc: r[11] || '', creator: 'asha', created: iso(-16),
    comments: (comments[r[0]] || []).map((c) => ({ by: c[0], text: c[1], at: iso(c[2]) })),
    activity: (activity[r[0]] || [['asha', 'created this task', -16]]).map((a) => ({ by: a[0], text: a[1], at: iso(a[2]) })),
    order: i,
  }));

  let tasks = seed();
  let nextNum = 19;
  const listeners = [];
  const emit = () => listeners.forEach((f) => f());

  const get = (id) => tasks.find((t) => t.id === id);
  const user = (id) => users.find((u) => u.id === id);
  const status = (id) => statuses.find((s) => s.id === id);
  const prio = (id) => priorities.find((p) => p.id === id);
  const list = (id) => lists.find((l) => l.id === id);
  const isClosed = (t) => status(t.status).type === 'Closed';
  const avatar = (id, size = 22) => {
    const u = user(id);
    if (!u) return `<span class="av none" style="width:${size}px;height:${size}px" title="Unassigned"></span>`;
    const ini = u.name.split(' ').map((w) => w[0]).join('');
    return `<span class="av" style="width:${size}px;height:${size}px;background:${u.color};font-size:${Math.round(size * .42)}px" title="${esc(u.name)}">${ini}</span>`;
  };
  /** due: {label, cls: overdue|today|soon|ok|none} */
  const dueInfo = (t) => {
    if (!t.due) return { label: '', cls: 'none', days: null };
    const d = daysFromToday(t.due);
    const late = d < 0 && !isClosed(t);
    return { label: fmtDate(t.due), cls: late ? 'overdue' : (d === 0 && !isClosed(t)) ? 'today' : (d <= 3 && d > 0 && !isClosed(t)) ? 'soon' : 'ok', days: d };
  };
  const log = (t, by, text) => t.activity.unshift({ by, text, at: iso(0) });
  const labelOf = { status: (v) => status(v).name, priority: (v) => prio(v).name, owner: (v) => (user(v) ? user(v).name : 'nobody'), list: (v) => list(v).name, due: (v) => (v ? fmtDate(v) : 'none') };
  const update = (id, patch, silent) => {
    const t = get(id); if (!t) return;
    Object.keys(patch).forEach((k) => {
      if (k === 'cf') { Object.assign(t.cf, patch.cf); return; }
      const before = t[k];
      if (before === patch[k]) return;
      t[k] = patch[k];
      if (!silent && labelOf[k]) log(t, ME, `changed ${k === 'owner' ? 'Owner' : k === 'due' ? 'Due date' : k[0].toUpperCase() + k.slice(1)} from ${labelOf[k](before)} to ${labelOf[k](patch[k])}`);
    });
    emit();
  };
  const add = (o) => {
    const num = nextNum++;
    const t = { id: 'WEB-T' + num, num, title: o.title, list: o.list || 'dev', status: o.status || 'open', priority: o.priority || 'none', owner: o.owner === undefined ? null : o.owner, due: o.due || null, start: null, tags: [], subtasks: [], cf: { effort: null, visible: null }, desc: '', creator: ME, created: iso(0), comments: [], activity: [{ by: ME, text: 'created this task', at: iso(0) }], order: tasks.length };
    tasks.push(t); emit(); return t;
  };
  const addComment = (id, text) => { const t = get(id); if (!t || !text.trim()) return; t.comments.push({ by: ME, text: text.trim(), at: iso(0) }); emit(); };
  const toggleSub = (id, idx) => { const t = get(id); t.subtasks[idx].done = !t.subtasks[idx].done; log(t, ME, (t.subtasks[idx].done ? 'completed' : 'reopened') + ' sub task "' + t.subtasks[idx].title + '"'); emit(); };
  const addSub = (id, title) => { const t = get(id); if (!title.trim()) return; t.subtasks.push({ id: t.id + '.' + (t.subtasks.length + 1), title: title.trim(), done: false, owner: null }); emit(); };
  const toggleTag = (id, tag) => { const t = get(id); const i = t.tags.indexOf(tag); if (i < 0) t.tags.push(tag); else t.tags.splice(i, 1); emit(); };
  const reset = () => { tasks = seed(); nextNum = 19; emit(); };

  /** Filter: {q, status:[], owner:[], priority:[], tag:[], list:[], due: 'overdue'|'week'|''} (empty = no filter). owner may contain 'none'. */
  const filter = (f) => tasks.filter((t) => {
    if (f.q && !(t.title + ' ' + t.id + ' ' + t.tags.join(' ')).toLowerCase().includes(f.q.toLowerCase())) return false;
    if (f.status && f.status.length && !f.status.includes(t.status)) return false;
    if (f.owner && f.owner.length && !f.owner.includes(t.owner || 'none')) return false;
    if (f.priority && f.priority.length && !f.priority.includes(t.priority)) return false;
    if (f.tag && f.tag.length && !t.tags.some((x) => f.tag.includes(x))) return false;
    if (f.list && f.list.length && !f.list.includes(t.list)) return false;
    if (f.due === 'overdue' && dueInfo(t).cls !== 'overdue') return false;
    if (f.due === 'week' && !(t.due && daysFromToday(t.due) <= 7 && !isClosed(t))) return false;
    if (f.open === true && isClosed(t)) return false;
    return true;
  });
  const byOrder = (a, b) => a.order - b.order;
  /** Groups by key: list | status | owner | priority | due | none. Returns [{id,label,items}] in a natural order, empty groups kept for status/list. */
  const groupBy = (items, key) => {
    const mk = (id, label, extra) => Object.assign({ id, label, items: [] }, extra || {});
    let gs;
    if (key === 'list') gs = lists.map((l) => mk(l.id, l.name, { list: l }));
    else if (key === 'status') gs = statuses.map((s) => mk(s.id, s.name, { status: s }));
    else if (key === 'priority') gs = priorities.slice().sort((a, b) => b.rank - a.rank).map((p) => mk(p.id, p.name));
    else if (key === 'owner') gs = users.map((u) => mk(u.id, u.name)).concat([mk('none', 'Unassigned')]);
    else if (key === 'due') gs = [mk('overdue', 'Overdue'), mk('week', 'Next 7 days'), mk('later', 'Later or completed'), mk('nodate', 'No due date')];
    else gs = [mk('all', 'All tasks')];
    items.slice().sort(byOrder).forEach((t) => {
      let id = 'all';
      if (key === 'list') id = t.list; else if (key === 'status') id = t.status; else if (key === 'priority') id = t.priority; else if (key === 'owner') id = t.owner || 'none';
      else if (key === 'due') { const d = dueInfo(t); id = !t.due ? 'nodate' : d.cls === 'overdue' ? 'overdue' : (d.days >= 0 && d.days <= 7) ? 'week' : 'later'; }
      gs.find((g) => g.id === id).items.push(t);
    });
    return (key === 'owner' || key === 'priority' || key === 'due') ? gs.filter((g) => g.items.length) : gs;
  };
  /** Applies a drop of a task into a group of the given grouping (used by boards). */
  const moveTo = (id, key, gid) => {
    if (key === 'status') update(id, { status: gid });
    else if (key === 'priority') update(id, { priority: gid });
    else if (key === 'owner') update(id, { owner: gid === 'none' ? null : gid });
    else if (key === 'list') update(id, { list: gid });
  };

  // ---------- tiny popup helper (styled by each page via the class passed in) ----------
  let openPop = null;
  const closePop = () => { if (openPop) { openPop.el.remove(); document.removeEventListener('mousedown', openPop.away, true); document.removeEventListener('keydown', openPop.key, true); openPop = null; } };
  /**
   * pop(anchor, {cls, title, items:[{id, html, on}], multi, search, onPick, width, align})
   * items[].on marks current selection. onPick(id, item). multi keeps the popup open (re-renders ticks).
   */
  const pop = (anchor, o) => {
    closePop();
    const el = document.createElement('div');
    el.className = 'pop ' + (o.cls || '');
    el.setAttribute('role', 'menu');
    let q = '', hi = 0;
    const visible = () => o.items.filter((i) => !q || (i.text || i.html.replace(/<[^>]+>/g, '')).toLowerCase().includes(q.toLowerCase()));
    const draw = () => {
      const vis = visible(); if (hi >= vis.length) hi = Math.max(0, vis.length - 1);
      el.innerHTML = (o.title ? `<div class="pop-t">${esc(o.title)}</div>` : '') + (o.search ? `<input class="pop-s" placeholder="${esc(o.search)}" value="${esc(q)}">` : '') +
        `<div class="pop-l">` + (vis.length ? vis.map((i, n) => `<button type="button" class="pop-i${i.on ? ' on' : ''}${n === hi ? ' hi' : ''}" data-id="${esc(i.id)}">${o.multi ? `<span class="pop-ck">${i.on ? '✓' : ''}</span>` : ''}${i.html}${!o.multi && i.on ? '<span class="pop-tick">✓</span>' : ''}</button>`).join('') : '<div class="pop-e">No matches</div>') + `</div>`;
      const s = el.querySelector('.pop-s'); if (s) { s.oninput = () => { q = s.value; hi = 0; const pos = s.selectionStart; draw(); const s2 = el.querySelector('.pop-s'); s2.focus(); s2.setSelectionRange(pos, pos); }; }
    };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('.pop-i'); if (!b) return;
      const item = o.items.find((i) => String(i.id) === b.dataset.id);
      if (o.multi) { item.on = !item.on; draw(); o.onPick(item.id, item); } else { closePop(); o.onPick(item.id, item); }
    });
    document.body.appendChild(el); draw();
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth, h = el.offsetHeight;
    let left = o.align === 'right' ? r.right - w : r.left;
    left = Math.max(8, Math.min(left, innerWidth - w - 8));
    let top = r.bottom + 4; if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 4);
    el.style.left = left + 'px'; el.style.top = top + 'px';
    const away = (e) => { if (!el.contains(e.target)) closePop(); };
    const key = (e) => {
      const vis = visible();
      if (e.key === 'Escape') { e.stopPropagation(); closePop(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(vis.length - 1, hi + 1); draw(); const s = el.querySelector('.pop-s'); if (s) s.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(0, hi - 1); draw(); const s = el.querySelector('.pop-s'); if (s) s.focus(); }
      else if (e.key === 'Enter' && vis[hi]) { e.preventDefault(); const b = el.querySelectorAll('.pop-i')[hi]; if (b) b.click(); }
    };
    setTimeout(() => document.addEventListener('mousedown', away, true), 0);
    document.addEventListener('keydown', key, true);
    openPop = { el, away, key };
    const s = el.querySelector('.pop-s'); if (s) s.focus();
    return el;
  };
  const toast = (msg) => {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 1800);
  };
  /** Native drag and drop for board cards: cards have draggable + data-id; columns have data-col. onDrop(taskId, colId). */
  const boardDnD = (root, onDrop) => {
    let dragId = null;
    root.addEventListener('dragstart', (e) => { const c = e.target.closest('[data-card]'); if (!c) return; dragId = c.dataset.card; e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; setTimeout(() => c.classList.add('dragging'), 0); });
    root.addEventListener('dragend', () => { dragId = null; root.querySelectorAll('.dragging,.over').forEach((n) => n.classList.remove('dragging', 'over')); });
    root.addEventListener('dragover', (e) => { const col = e.target.closest('[data-col]'); if (!col || !dragId) return; e.preventDefault(); root.querySelectorAll('.over').forEach((n) => n !== col && n.classList.remove('over')); col.classList.add('over'); });
    root.addEventListener('drop', (e) => { const col = e.target.closest('[data-col]'); if (!col || !dragId) return; e.preventDefault(); const id = dragId; dragId = null; col.classList.remove('over'); onDrop(id, col.dataset.col, col.dataset.lane || ''); });
  };
  const on = (f) => listeners.push(f);
  const dayLabel = (s) => { const d = daysFromToday(s); return d === 0 ? 'today' : d === -1 ? 'yesterday' : d < 0 ? Math.abs(d) + ' days ago' : fmtDate(s); };

  return { esc, clone, project, users, ME, statuses, priorities, lists, tags, customFields, get tasks() { return tasks; }, get, user, status, prio, list, isClosed, avatar, dueInfo, fmtDate, fmtLong, daysFromToday, dayLabel, update, add, addComment, toggleSub, addSub, toggleTag, reset, filter, groupBy, moveTo, pop, closePop, toast, boardDnD, on, today };
})();
