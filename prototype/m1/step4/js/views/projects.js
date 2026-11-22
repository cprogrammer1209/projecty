/*
 * M1 · Step 4 · Projects (docs/requirements/04-projects.md, MVP stories PRJ-US-01 to 07, plus trash and members).
 * Screens: list, create and edit (full pages), overview (status, members, delete), trash.
 * Reuses the Settings table/panel/dialog look through the `.users-page` wrapper class.
 */
const Projects = (() => {
  const { esc, icon, spinner, field, input, alertBox, initials, component, formatDate, Router } = PY;
  const KEY_RX = /^[A-Z0-9]{2,10}$/;
  const KEY_CHECK_DELAY_MS = 350;
  const ACTION_LABELS = () => Object.fromEntries(Store.auditActions());

  /** One-shot message shown on the next screen (e.g. after create or delete). */
  let flash = null;
  const takeFlash = () => { const f = flash; flash = null; return f; };

  const base = (ctx) => `#/p/${ctx.slug}/projects`;
  const day = (d, ctx) => (d ? formatDate(new Date(d + 'T00:00:00Z'), ctx.portal.dateFormat, 'UTC') : '—');
  const dates = (p, ctx) => (p.startDate || p.endDate ? `${day(p.startDate, ctx)} → ${day(p.endDate, ctx)}` : 'No dates');
  const when = (t, ctx) => formatDate(t, `${ctx.portal.dateFormat}, h:mm a`, ctx.timeZone);
  const options = (items, selected) => items.map(([v, l]) => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const sync = (el, s, onChange) => el.querySelectorAll('[name]').forEach((n) => n.addEventListener('input', () => { s[n.name] = n.type === 'checkbox' ? n.checked : n.value; if (onChange) onChange(n.name, n); }));

  /* Same status list as the backend's default project statuses; the look is icon + label, never a solid fill. */
  const LOOK = { Active: ['progress', 's-progress'], 'In Progress': ['progress', 's-progress'], 'On Track': ['progress', 's-progress'], Delayed: ['review', 's-review'], 'On Hold': ['open', 'dot'], Completed: ['done', 'check'], Cancelled: ['blocked', 'alert'] };
  const pill = (status) => { const [cls, ic] = LOOK[status] || ['open', 'dot']; return `<span class="py-pill py-pill--${cls}">${icon(ic)}${esc(status)}</span>`; };
  const progress = (p) => `<div class="pbar" title="Progress comes from closed tasks (Step 6)"><div class="bar"><i class="d" style="width:${p.progress}%"></i></div><span>${p.progress}%</span></div>`;
  const visChip = (v) => `<span class="chip-vis" title="${v === 'PUBLIC' ? 'Visible to every employee in the portal, read-only' : 'Only members and Admins can see it'}">${icon(v === 'PUBLIC' ? 'globe' : 'user')}${v === 'PUBLIC' ? 'Public' : 'Private'}</span>`;

  /** "Website Redesign" -> WR, "Mobile" -> MOBI (suggested while the key box is untouched). */
  function suggestKey(name) {
    const words = (name.match(/[A-Za-z0-9]+/g) || []);
    const key = (words.length > 1 ? words.map((w) => w[0]).join('').slice(0, 5) : (words[0] || '').slice(0, 4)).toUpperCase();
    return key.length >= 2 ? key : '';
  }

  /* ---------- shared dialogs (mounted into #app, so a route change removes them) ---------- */
  function mountDialog(render, bind, state) {
    const host = document.createElement('div'); host.className = 'pd-overlay';
    document.getElementById('app').appendChild(host);
    const api = component(host, state, (s) => `<section class="pd-dialog" role="dialog" aria-modal="true" aria-labelledby="pd-title">${render(s)}</section>`, (el, a) => {
      el.querySelectorAll('[data-pd-close]').forEach((b) => b.addEventListener('click', close));
      host.onclick = (e) => { if (e.target === host) close(); };
      bind(el, a);
    });
    function close() { host.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    api.close = close;
    return api;
  }

  function confirmDialog({ title, body, label, danger = true, onConfirm }) {
    mountDialog((s) => `<h2 id="pd-title">${esc(title)}</h2><p class="pd-lead">${esc(body)}</p>${s.error ? alertBox(s.error) : ''}
      <div class="pd-actions"><button class="py-btn py-btn--secondary" type="button" data-pd-close>Cancel</button>
      <button class="py-btn ${danger ? 'py-btn--danger' : 'py-btn--primary'}" type="button" id="pd-yes" ${s.busy ? 'disabled' : ''}>${s.busy ? spinner : ''}${esc(label)}</button></div>`,
    (el, api) => el.querySelector('#pd-yes').addEventListener('click', async () => {
      api.set({ busy: true, error: null });
      try { await onConfirm(); api.close(); } catch (err) { api.set({ busy: false, error: err.message }); }
    }), { busy: false, error: null });
  }

  /** Create and edit share one full page: details on the left, a live preview on the right, actions in a bar at the bottom. */
  function formPage(el, ctx, { project = null, people }) {
    const editing = !!project;
    const s = { name: project?.name ?? '', key: project?.key ?? '', ownerId: project?.owner.id ?? ctx.me.id, startDate: project?.startDate ?? '', endDate: project?.endDate ?? '',
      visibility: project?.visibility ?? 'PRIVATE', description: project?.description ?? '', keyEdited: editing, keyStatus: { kind: 'idle' }, submitted: false, busy: false, error: null };
    let timer = null, seq = 0;
    const keyOk = () => KEY_RX.test(s.key);
    const errs = () => ({
      name: s.submitted && !s.name.trim() ? 'Name the project.' : s.submitted && s.name.length > 100 ? 'Use 100 characters or fewer.' : null,
      key: editing ? null : s.submitted && !keyOk() ? 'Use 2 to 10 capital letters or numbers.' : null,
      end: s.startDate && s.endDate && s.endDate < s.startDate ? "The end date can't be before the start date." : null,
    });
    const keyRegion = () => (s.keyStatus.kind === 'checking' ? '<p class="py-field__hint">Checking…</p>' : s.keyStatus.kind === 'ok' ? `<p class="py-field__ok">${icon('check')}${esc(s.key)} is available</p>`
      : s.keyStatus.kind === 'taken' ? `<p class="py-field__error">${icon('alert')}The key ${esc(s.key)} is already used in this portal.</p>` : '');
    const ownerName = () => people.find((x) => x.userId === s.ownerId)?.fullName ?? '';
    const back = editing ? `${base(ctx)}/${project.id}` : base(ctx);
    const radio = (value, title, text, ic) => `<label class="radio-card"><input type="radio" name="visibility" value="${value}" ${s.visibility === value ? 'checked' : ''}><span class="rc-ic">${icon(ic)}</span><span><strong>${title}</strong><small>${text}</small></span></label>`;

    const render = (s) => {
      const e = errs();
      return `<div class="users-page projects-page form-page">
        <a class="back" href="${back}">${icon('arrow-left')}${editing ? esc(project.name) : 'All projects'}</a>
        <div class="page-title"><div><h1>${editing ? 'Edit project' : 'New project'}</h1>
          <p>${editing ? 'Update the details. The key stays the same, because item IDs like ' + esc(project.key) + '-T42 depend on it.' : 'A project holds the phases, tasks and documents of one piece of work. You become its owner and Manager.'}</p></div></div>
        ${s.error ? alertBox(s.error) : ''}
        <form class="pf" novalidate>
          <div class="pf-grid">
            <div class="pf-main">
              <section class="panel pf-card"><h2>Basics</h2>
                ${field({ label: 'Project name', id: 'pj-name', error: e.name, body: input({ id: 'pj-name', name: 'name', value: s.name, placeholder: 'Website Redesign', error: e.name }) })}
                <div class="pf-row">
                  ${field({ label: 'Key', id: 'pj-key', error: e.key, hint: editing ? "Can't be changed after creation." : '2 to 10 capital letters or numbers. Used in item IDs.',
                    body: `<div class="py-input-wrap key-wrap"><input id="pj-key" name="key" type="text" value="${esc(s.key)}" maxlength="10" autocomplete="off" spellcheck="false" placeholder="WEB" ${editing ? 'disabled' : ''} ${e.key ? 'aria-invalid="true"' : ''} /></div><div id="pj-key-region">${keyRegion()}</div>` })}
                  ${field({ label: 'Owner', id: 'pj-owner', hint: 'The owner is always a Manager of the project.', body: `<select id="pj-owner" name="ownerId" class="py-select">${options(people.map((p) => [p.userId, p.fullName + (p.userId === ctx.me.id ? ' (you)' : '')]), s.ownerId)}</select>` })}
                </div>
                ${field({ label: 'Description', id: 'pj-desc', hint: 'Optional. Shown on the project overview.', body: `<textarea id="pj-desc" name="description" class="py-textarea" rows="5" placeholder="What is this project for?">${esc(s.description)}</textarea>` })}
              </section>
              <section class="panel pf-card"><h2>Schedule</h2><p class="pf-sub">Dates are optional. You can set them later.</p>
                <div class="pf-row">
                  ${field({ label: 'Start date', id: 'pj-start', body: input({ id: 'pj-start', name: 'startDate', type: 'date', value: s.startDate }) })}
                  ${field({ label: 'End date', id: 'pj-end', error: e.end, body: input({ id: 'pj-end', name: 'endDate', type: 'date', value: s.endDate, error: e.end }) })}
                </div>
              </section>
              <section class="panel pf-card"><h2>Who can see it</h2>
                <div class="radio-cards" role="radiogroup" aria-label="Who can see the project">
                  ${radio('PRIVATE', 'Private', 'Only the project members and Admins can see it.', 'user')}
                  ${radio('PUBLIC', 'Public', 'Every employee in the portal can see it, read-only. Clients only if they are members.', 'globe')}
                </div>
              </section>
            </div>
            <aside class="pf-side"><section class="panel pf-card pf-preview"><h2>Preview</h2>
              <div class="pv-top"><span class="key" data-pv="key"></span><span class="chip-vis" data-pv="vis"></span></div>
              <div class="pv-name" data-pv="name"></div>
              <dl class="pv-facts">
                <div><dt>Owner</dt><dd data-pv="owner"></dd></div>
                <div><dt>Dates</dt><dd data-pv="dates"></dd></div>
                <div><dt>Status</dt><dd>${editing ? esc(project.status) : 'Active (you can change it later)'}</dd></div>
                <div><dt>First item ID</dt><dd class="mono" data-pv="item"></dd></div>
              </dl></section></aside>
          </div>
          <div class="pf-bar"><a class="py-btn py-btn--secondary" href="${back}">Cancel</a>
            <button class="py-btn py-btn--primary" type="submit" ${s.busy ? 'disabled' : ''}>${s.busy ? `${spinner}Saving` : editing ? 'Save changes' : 'Create project'}</button></div>
        </form></div>`;
    };
    const paintPreview = (el) => {
      const set = (k, t) => { const n = el.querySelector(`[data-pv="${k}"]`); if (n) n.textContent = t; };
      set('key', s.key || 'KEY'); set('name', s.name.trim() || 'Untitled project'); set('owner', ownerName());
      set('dates', s.startDate || s.endDate ? `${day(s.startDate, ctx)} → ${day(s.endDate, ctx)}` : 'No dates yet'); set('item', `${s.key || 'KEY'}-T1`);
      const v = el.querySelector('[data-pv="vis"]'); if (v) v.innerHTML = `${icon(s.visibility === 'PUBLIC' ? 'globe' : 'user')}${s.visibility === 'PUBLIC' ? 'Public' : 'Private'}`;
    };
    const api = component(el, s, render, (el, a) => {
      if (s.keyStatus.kind === 'taken') el.querySelector('#pj-key')?.closest('.py-field').classList.add('is-invalid');
      const checkKey = () => {
        clearTimeout(timer);
        s.keyStatus = { kind: keyOk() ? 'checking' : 'idle' };
        el.querySelector('#pj-key-region').innerHTML = keyRegion();
        el.querySelector('#pj-key').closest('.py-field').classList.remove('is-invalid');
        if (!keyOk()) return;
        const mine = ++seq;
        timer = setTimeout(async () => {
          const res = await Store.keyStatus(ctx.portal.id, s.key);
          if (mine !== seq || !document.body.contains(el)) return;
          s.keyStatus = { kind: res.available ? 'ok' : 'taken' };
          el.querySelector('#pj-key-region').innerHTML = keyRegion();
          el.querySelector('#pj-key').closest('.py-field').classList.toggle('is-invalid', !res.available);
        }, KEY_CHECK_DELAY_MS);
      };
      sync(el, s, (name, node) => {
        if (name === 'name' && !editing && !s.keyEdited) { s.key = suggestKey(s.name); el.querySelector('#pj-key').value = s.key; checkKey(); }
        if (name === 'key') { const clean = node.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); node.value = clean; s.key = clean; s.keyEdited = clean.length > 0; checkKey(); }
        paintPreview(el);
      });
      paintPreview(el);
      if (!editing && s.key) checkKey();
      el.querySelector('form').addEventListener('submit', async (ev) => {
        ev.preventDefault(); s.submitted = true; s.error = null;
        const e = errs();
        if (!s.name.trim() || e.name || (!editing && (!keyOk() || e.key || s.keyStatus.kind === 'taken')) || e.end) { a.paint(); window.scrollTo(0, 0); return PY.focusFirstInvalid(el); }
        a.set({ busy: true });
        try {
          const f = { name: s.name, key: s.key, ownerId: s.ownerId, startDate: s.startDate, endDate: s.endDate, visibility: s.visibility, description: s.description };
          if (editing) { await Store.updateProject(ctx.portal.id, project.id, f); flash = 'Project updated.'; Router.navigate(`${base(ctx).slice(1)}/${project.id}`); }
          else { const res = await Store.createProject(ctx.portal.id, f); flash = 'Project created. You are its owner and Manager.'; Router.navigate(`${base(ctx).slice(1)}/${res.id}`); }
        } catch (err) {
          if (err.code === 'KEY_TAKEN') { s.keyStatus = { kind: 'taken' }; a.set({ busy: false }); } else { a.set({ busy: false, error: err.message }); window.scrollTo(0, 0); }
        }
      });
      if (!editing && !s.name) el.querySelector('#pj-name').focus();
    });
    return api;
  }

  /** /projects/new: load the portal's people, then show the form. */
  async function create(el, ctx) {
    el.innerHTML = '<div class="users-page projects-page"><p class="py-caption">Loading…</p></div>';
    try { formPage(el, ctx, { people: await Store.projectPeople(ctx.portal.id) }); }
    catch (err) { el.innerHTML = `<div class="users-page projects-page">${alertBox(err.message)}</div>`; }
  }

  /** /projects/:id/edit: needs edit rights; otherwise explain and link back. */
  async function edit(el, ctx) {
    el.innerHTML = '<div class="users-page projects-page"><p class="py-caption">Loading…</p></div>';
    const notFound = (title, text) => { el.innerHTML = `<div class="users-page projects-page"><section class="panel"><div class="empty" style="padding:40px 18px"><b>${title}</b><br>${text}<br><br><a class="py-btn py-btn--secondary" href="${base(ctx)}">Back to projects</a></div></section></div>`; };
    try {
      const [project, people] = await Promise.all([Store.project(ctx.portal.id, ctx.params.id), Store.projectPeople(ctx.portal.id)]);
      if (!project.canEdit) return notFound("You can't edit this project", 'Only Admins, the owner and project Managers can edit it.');
      formPage(el, ctx, { project, people });
    } catch (err) { if (err.code === 'PROJECT_NOT_FOUND') notFound('Project not found', "It doesn't exist, was moved to the trash, or you can't see it."); else el.innerHTML = `<div class="users-page projects-page">${alertBox(err.message)}</div>`; }
  }

  /* ---------- list ---------- */
  function list(el, ctx) {
    const s = { items: null, q: '', status: 'ALL', owner: 'ALL', sort: 'name', error: null, notice: takeFlash() };
    const canCreate = ctx.can('PROJECTS_CREATE');
    const SORTS = { name: (a, b) => a.name.localeCompare(b.name), key: (a, b) => a.key.localeCompare(b.key), end: (a, b) => (a.endDate || '9999').localeCompare(b.endDate || '9999'), status: (a, b) => a.status.localeCompare(b.status) };
    const visible = () => (s.items || []).filter((p) => (s.status === 'ALL' || p.status === s.status) && (s.owner === 'ALL' || p.owner.id === s.owner)
      && (!s.q.trim() || `${p.name} ${p.key}`.toLowerCase().includes(s.q.trim().toLowerCase()))).sort(SORTS[s.sort]);
    const render = (s) => {
      const rows = visible().map((p) => `<tr class="click" data-open="${esc(p.id)}" tabindex="0" role="link" aria-label="Open ${esc(p.name)}">
        <td><div class="proj"><span class="key">${esc(p.key)}</span><div><strong>${esc(p.name)}</strong>${p.description ? `<small>${esc(p.description)}</small>` : ''}</div></div></td>
        <td>${pill(p.status)}</td>
        <td><div class="person"><span class="py-avatar py-avatar--sm">${esc(initials(p.owner.name))}</span><div><strong>${esc(p.owner.name)}</strong></div></div></td>
        <td>${progress(p)}</td><td class="nowrap">${esc(dates(p, ctx))}</td><td class="chev">${icon('chevron-right')}</td></tr>`).join('');
      const filtering = s.q || s.status !== 'ALL' || s.owner !== 'ALL';
      const empty = !s.items ? 'Loading projects…' : filtering ? 'No projects match.' : canCreate ? 'No projects yet. Create the first one.' : 'You are not in any project yet.';
      const owners = [...new Map((s.items || []).map((p) => [p.owner.id, p.owner.name])).entries()];
      return `<div class="users-page projects-page">
        <div class="page-title"><div><h1>Projects</h1><p>${s.items ? `${s.items.length} you can see in ${esc(ctx.portal.name)}` : ' '}</p></div>
          <div class="page-actions"><a class="py-btn py-btn--ghost" href="${base(ctx)}/trash">${icon('inbox')}Trash</a>
          ${canCreate ? `<a class="py-btn py-btn--primary" href="${base(ctx)}/new">${icon('plus')}New project</a>` : ''}</div></div>
        ${s.error ? alertBox(s.error) : ''}${s.notice ? `<div class="py-alert py-alert--ok" role="status">${icon('check')}<span>${esc(s.notice)}</span></div>` : ''}
        <section class="panel">
          <div class="filters">
            <label class="py-input-wrap search">${icon('search')}<input id="p-search" name="q" placeholder="Search by name or key" aria-label="Search projects" value="${esc(s.q)}" /></label>
            <select class="py-select" name="status" aria-label="Filter by status">${options([['ALL', 'All statuses'], ...Store.PROJECT_STATUSES.map((x) => [x.name, x.name])], s.status)}</select>
            <select class="py-select" name="owner" aria-label="Filter by owner">${options([['ALL', 'All owners'], ...owners], s.owner)}</select>
            <select class="py-select" name="sort" aria-label="Sort by">${options([['name', 'Sort: name'], ['key', 'Sort: key'], ['end', 'Sort: end date'], ['status', 'Sort: status']], s.sort)}</select>
          </div>
          <div class="table-wrap"><table>
            <thead><tr><th>Project</th><th>Status</th><th>Owner</th><th>Progress</th><th>Dates</th><th></th></tr></thead>
            <tbody>${rows || `<tr><td colspan="6" class="empty">${empty}</td></tr>`}</tbody></table></div>
        </section></div>`;
    };
    let api;
    const repaint = () => { const had = document.activeElement?.id === 'p-search', pos = document.activeElement?.selectionStart; api.paint(); if (had) { const n = el.querySelector('#p-search'); n.focus(); n.setSelectionRange(pos, pos); } };
    const load = async () => { try { s.items = await Store.projects(ctx.portal.id); } catch (err) { s.items = s.items || []; s.error = err.message; } repaint(); };
    api = component(el, s, render, (el) => {
      sync(el, s, () => repaint());
      const open = (id) => Router.navigate(`${base(ctx).slice(1)}/${id}`);
      el.querySelectorAll('[data-open]').forEach((r) => { r.addEventListener('click', () => open(r.dataset.open)); r.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(r.dataset.open); }); });

    });
    load();
  }

  /* ---------- overview ---------- */
  function overview(el, ctx) {
    const id = ctx.params.id;
    const s = { p: null, people: [], error: null, notice: takeFlash(), busy: false, addUser: '', addRole: 'Member', missing: false };
    const render = (s) => {
      if (s.missing) return `<div class="users-page projects-page"><section class="panel"><div class="empty" style="padding:40px 18px"><b>Project not found</b><br>It doesn't exist, was moved to the trash, or you can't see it.<br><br><a class="py-btn py-btn--secondary" href="${base(ctx)}">Back to projects</a></div></section></div>`;
      const p = s.p;
      if (!p) return `<div class="users-page projects-page"><p class="py-caption">Loading project…</p></div>`;
      const free = s.people.filter((x) => !p.members.some((m) => m.userId === x.userId));
      const labels = ACTION_LABELS();
      return `<div class="users-page projects-page">
        <a class="back" href="${base(ctx)}">${icon('arrow-left')}All projects</a>
        ${s.error ? alertBox(s.error) : ''}${s.notice ? `<div class="py-alert py-alert--ok" role="status">${icon('check')}<span>${esc(s.notice)}</span></div>` : ''}
        <div class="page-title"><div><div class="ov-key"><span class="key">${esc(p.key)}</span>${visChip(p.visibility)}</div><h1>${esc(p.name)}</h1>
          <p>Owned by ${esc(p.owner.name)} · ${esc(dates(p, ctx))}</p></div>
          <div class="page-actions">
            ${p.canEdit ? `<select class="py-select status-select" id="status" aria-label="Project status">${options(Store.PROJECT_STATUSES.map((x) => [x.name, x.name]), p.status)}</select>` : pill(p.status)}
            ${p.canEdit ? `<a class="py-btn py-btn--secondary" id="edit" href="${base(ctx)}/${esc(p.id)}/edit">Edit</a>` : ''}
            ${p.canDelete ? `<button class="py-btn py-btn--ghost danger" type="button" id="del">${icon('log-out')}Delete</button>` : ''}</div></div>
        ${!p.canEdit ? `<div class="py-alert" role="status">${icon('alert')}<span>${p.isMember ? 'Your project role is Member, so this project is read-only for you.' : 'You can see this project, but you are not a member, so it is read-only.'}</span></div>` : ''}
        <div class="stats">${[['Progress', `${p.progress}%`, 'Closed tasks ÷ all tasks'], ['Open tasks', '—', 'Tasks arrive next'], ['Closed tasks', '—', 'Tasks arrive next'], ['Overdue', '—', 'Needs tasks with dates']].map(([l, v, f]) => `<div class="stat"><div class="stat-label">${l}</div><div class="stat-value">${v}</div><div class="stat-foot">${f}</div></div>`).join('')}</div>
        <div class="ov-grid">
          <div class="stack">
            <section class="panel"><div class="panel-head"><div><h2>About</h2></div></div><div class="about">${p.description ? `<p>${esc(p.description)}</p>` : '<p class="muted">No description yet.</p>'}</div></section>
            <section class="panel"><div class="panel-head"><div><h2>Upcoming phases</h2><p>Milestones and their dates</p></div></div><div class="empty line">Phases arrive with the next step.</div></section>
            <section class="panel"><div class="panel-head"><div><h2>Recent activity</h2><p>Changes to this project</p></div></div>
              ${p.activity.length ? `<ul class="act">${p.activity.map((a) => `<li><span class="py-avatar py-avatar--sm">${esc(initials(a.actorName))}</span><div><strong>${esc(a.actorName)}</strong> <span class="muted">${esc(labels[a.action] ?? a.action)}</span><br><small>${esc(a.detail ?? '')} · ${esc(when(a.occurredAt, ctx))}</small></div></li>`).join('')}</ul>` : '<div class="empty line">No activity yet.</div>'}</section>
          </div>
          <div class="stack">
            <section class="panel"><div class="panel-head"><div><h2>Members</h2><p>${p.members.length} in this project</p></div></div>
              <ul class="members">${p.members.map((m) => `<li><span class="py-avatar">${esc(initials(m.fullName))}</span><div class="mi"><strong>${esc(m.fullName)}${m.userId === ctx.me.id ? '<span class="you"> (you)</span>' : ''}</strong><small>${esc(m.email)}</small></div>
                <span class="chip">${m.owner ? 'Owner · ' : ''}${esc(m.role)}</span>${p.canEdit && !m.owner ? `<button class="icon-x" type="button" data-remove="${esc(m.userId)}" aria-label="Remove ${esc(m.fullName)} from the project" title="Remove">✕</button>` : ''}</li>`).join('')}</ul>
              ${p.canEdit ? `<form class="add-member" novalidate>${free.length ? `<select class="py-select" name="addUser" aria-label="Person to add"><option value="">Add a person…</option>${options(free.map((x) => [x.userId, `${x.fullName} · ${x.profileName}`]), s.addUser)}</select>
                <select class="py-select role" name="addRole" aria-label="Project role">${options([['Member', 'Member'], ['Manager', 'Manager']], s.addRole)}</select>
                <button class="py-btn py-btn--secondary" type="submit" ${!s.addUser || s.busy ? 'disabled' : ''}>Add</button>` : '<p class="muted">Everyone in the portal is already in this project.</p>'}</form>
                <p class="hint">Only people already in the portal can join. Invite new people in Settings → Users.</p>` : ''}</section>
          </div>
        </div></div>`;
    };
    let api;
    const load = async () => {
      try { const [p, people] = await Promise.all([Store.project(ctx.portal.id, id), Store.projectPeople(ctx.portal.id)]); s.p = p; s.people = people; }
      catch (err) { if (err.code === 'PROJECT_NOT_FOUND') s.missing = true; else s.error = err.message; }
      api.paint();
    };
    const act = async (fn, notice) => { s.error = null; s.notice = null; s.busy = true; api.paint(); try { await fn(); if (notice) s.notice = notice; } catch (err) { s.error = err.message; } s.busy = false; s.addUser = ''; await load(); };
    api = component(el, s, render, (el) => {
      sync(el, s, (name) => { if (name === 'addUser') { el.querySelector('.add-member button').disabled = !s.addUser; } });
      el.querySelector('#status')?.addEventListener('change', (e) => act(() => Store.setProjectStatus(ctx.portal.id, id, e.target.value), `Status changed to ${e.target.value}.`));
      el.querySelector('#del')?.addEventListener('click', () => confirmDialog({ title: `Delete ${s.p.name}?`, label: 'Move to trash',
        body: 'It moves to the trash with everything in it. You or an Admin can restore it from Projects → Trash.',
        onConfirm: async () => { await Store.deleteProject(ctx.portal.id, id); flash = `${s.p.name} moved to the trash.`; Router.navigate(base(ctx).slice(1)); } }));
      el.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => act(() => Store.removeProjectMember(ctx.portal.id, id, b.dataset.remove), 'Member removed.')));
      el.querySelector('.add-member')?.addEventListener('submit', (e) => { e.preventDefault(); if (s.addUser) act(() => Store.addProjectMember(ctx.portal.id, id, { userId: s.addUser, role: s.addRole }), 'Member added.'); });
    });
    load();
  }

  /* ---------- trash ---------- */
  function trash(el, ctx) {
    const s = { items: null, error: null, notice: null, busy: null };
    const render = (s) => `<div class="users-page projects-page">
      <a class="back" href="${base(ctx)}">${icon('arrow-left')}All projects</a>
      <div class="page-title"><div><h1>Trash</h1><p>Deleted projects you own or, as an Admin, in this portal. Restoring brings back everything in them.</p></div></div>
      ${s.error ? alertBox(s.error) : ''}${s.notice ? `<div class="py-alert py-alert--ok" role="status">${icon('check')}<span>${esc(s.notice)}</span></div>` : ''}
      <section class="panel"><div class="table-wrap"><table>
        <thead><tr><th>Project</th><th>Deleted by</th><th>Deleted</th><th></th></tr></thead>
        <tbody>${!s.items ? '<tr><td colspan="4" class="empty">Loading…</td></tr>' : s.items.length ? s.items.map((p) => `<tr>
          <td><div class="proj"><span class="key">${esc(p.key)}</span><div><strong>${esc(p.name)}</strong><small>${esc(p.status)}</small></div></div></td>
          <td>${esc(p.deletedBy)}</td><td class="nowrap">${esc(when(p.deletedAt, ctx))}</td>
          <td class="actions"><button class="py-btn py-btn--secondary" type="button" data-restore="${esc(p.id)}" ${s.busy === p.id ? 'disabled' : ''}>Restore</button></td></tr>`).join('') : '<tr><td colspan="4" class="empty">The trash is empty.</td></tr>'}</tbody></table></div></section></div>`;
    let api;
    const load = async () => { try { s.items = await Store.trashedProjects(ctx.portal.id); } catch (err) { s.items = s.items || []; s.error = err.message; } api.paint(); };
    api = component(el, s, render, (el) => el.querySelectorAll('[data-restore]').forEach((b) => b.addEventListener('click', async () => {
      const p = s.items.find((x) => x.id === b.dataset.restore); s.busy = p.id; s.error = null; api.paint();
      try { await Store.restoreProject(ctx.portal.id, p.id); s.notice = `${p.name} restored.`; } catch (err) { s.error = err.message; }
      s.busy = null; load();
    })));
    load();
  }

  return { list, overview, trash, create, edit };
})();
