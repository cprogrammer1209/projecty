/*
 * M1 · Step 6 · Tasks (docs/requirements/06-tasks.md), Linear style.
 *   Tasks.tab    project → Tasks: the shared list engine (js/views/tasklist.js: groups, board, filters, peek, shortcuts), the Lists menu, trash.
 *   Tasks.detail a task, full page or peek panel: inline title and description, sub-tasks, one timeline of activity and comments with the comment box,
 *                and a properties sidebar (click-to-edit, no Save or Cancel) with tags, followers and the custom fields of the project's task layout.
 * The mock rules are in js/store.js (TSK-BR-01 to 18, the MVP subset).
 */
const Tasks = (() => {
  const { esc, icon, spinner, field, input, alertBox, component, formatDate, initials, Router } = PY;
  const base = (ctx, id) => `#/p/${ctx.slug}/projects/${id}`;
  const taskUrl = (ctx, projectId, taskId) => `${base(ctx, projectId)}/tasks/${taskId}`;
  const day = (d, ctx) => (d ? formatDate(new Date(d + 'T00:00:00Z'), ctx.portal.dateFormat, 'UTC') : '');
  const when = (t, ctx) => formatDate(t, `${ctx.portal.dateFormat}, h:mm a`, ctx.timeZone);
  const hex = (key) => (Store.STATUS_COLORS.find(([k]) => k === key) || Store.STATUS_COLORS[0])[2];
  const PRIO = Object.fromEntries(Store.TASK_PRIORITIES);
  let flash = null;
  const takeFlash = () => { const f = flash; flash = null; return f; };
  const plural = (n, w) => `${n} ${n === 1 ? w : w + 's'}`;
  /** `from` ('tasks' | 'tasks-all') makes the task page's back link return to the portal Tasks module. */
  const taskHref = (ctx, projectId, taskId, from = '') => `${taskUrl(ctx, projectId, taskId)}${from ? `?from=${from}` : ''}`;

  /* ---------- small pieces ---------- */
  const statusChip = (st) => `<span class="st-chip ${st.type === 'CLOSED' ? 'closed' : 'open'}" style="--c:${hex(st.color)}" title="${st.type === 'CLOSED' ? 'Closed status' : 'Open status'}"><i aria-hidden="true"></i>${esc(st.name)}</span>`;
  const prio = (p) => (p === 'NONE' ? '<span class="prio none" title="No priority">—</span>' : `<span class="prio ${p.toLowerCase()}" title="Priority: ${esc(PRIO[p])}"><i aria-hidden="true"></i>${esc(PRIO[p])}</span>`);
  const owners = (list) => (list.length ? `<span class="avs" title="${esc(list.map((o) => o.name).join(', '))}">${list.slice(0, 3).map((o) => `<span class="py-avatar py-avatar--sm" aria-label="${esc(o.name)}">${esc(initials(o.name))}</span>`).join('')}${list.length > 3 ? `<span class="py-avatar py-avatar--sm more">+${list.length - 3}</span>` : ''}</span>` : '<span class="muted" title="No owner">—</span>');
  const dueCell = (t, ctx) => (t.dueDate ? `<span class="due${t.overdue ? ' over' : ''}" title="${t.overdue ? 'Overdue' : 'Due date'}">${esc(day(t.dueDate, ctx))}</span>` : '<span class="muted">—</span>');
  const subCount = (t) => (t.subtaskCount ? `<span class="subc" title="${t.subtasksDone} of ${t.subtaskCount} subtasks closed">${icon('layers')}${t.subtasksDone}/${t.subtaskCount}</span>` : '');

  /** A small form dialog (mounted in #app so a route change removes it). `fields` is html; onSubmit(form) returns a message to show, or nothing to close. */
  function formDialog({ title, lead = '', body = '', label, onSubmit, onClose = null }) {
    const host = document.createElement('div'); host.className = 'pd-overlay';
    document.getElementById('app').appendChild(host);
    const close = () => { host.remove(); document.removeEventListener('keydown', onKey); if (onClose) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    host.onclick = (e) => { if (e.target === host) close(); };
    component(host, { busy: false, error: null }, (s) => `<form class="pd-dialog" role="dialog" aria-modal="true" aria-labelledby="pd-title" novalidate><h2 id="pd-title">${esc(title)}</h2>${lead ? `<p class="pd-lead">${lead}</p>` : ''}${body}${s.error ? alertBox(s.error) : ''}
      <div class="pd-actions"><button class="py-btn py-btn--secondary" type="button" data-close>Cancel</button><button class="py-btn py-btn--primary" type="submit" ${s.busy ? 'disabled' : ''}>${s.busy ? spinner : ''}${esc(label)}</button></div></form>`,
    (el, api) => {
      el.querySelector('[data-close]').addEventListener('click', close);
      el.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault(); const form = e.target; api.state.draft = Object.fromEntries(new FormData(form));
        api.set({ busy: true, error: null });
        let msg = null; try { msg = await onSubmit(form); } catch (err) { msg = err.message; }
        if (msg) api.set({ busy: false, error: msg }); else close();
      });
      el.querySelector('input,select,textarea')?.focus();
    });
  }

  /* ======================= project → Tasks ======================= */
  /** The list itself (toolbar, chips, groups, board, peek, shortcuts) is TaskList (js/views/tasklist.js); this screen is the project chrome, the Lists menu and the Trash. */
  function tab(el, ctx) {
    const projectId = ctx.params.id, portalId = ctx.portal.id;
    const s = { meta: null, people: [], trashView: false, trash: null, notice: takeFlash(), error: null, missing: false, state: {}, pre: null };
    let engine = null;
    const trashHtml = () => `<section class="panel trash-panel"><div class="panel-head"><div><h2>Trash</h2><p>Deleted tasks, with their subtasks. Restore brings everything back.</p></div><button class="py-btn py-btn--secondary" type="button" id="toggle-trash">Back to tasks</button></div>
      <div class="table-wrap"><table><thead><tr><th>Task</th><th>Deleted</th><th></th></tr></thead><tbody>${s.trash ? (s.trash.length ? s.trash.map((t) => `<tr><td><a href="${taskUrl(ctx, projectId, t.id)}"><span class="mono">${esc(t.key)}</span> ${esc(t.title)}</a>${t.subtaskCount ? `<small class="cf-sub">${plural(t.subtaskCount, 'subtask')}</small>` : ''}</td><td>${esc(when(t.deletedAt, ctx))}</td>
        <td class="actions">${s.meta.canRestore ? `<button class="py-btn py-btn--secondary" type="button" data-restore="${esc(t.id)}">Restore</button>` : ''}</td></tr>`).join('') : '<tr><td colspan="3" class="empty">The trash is empty.</td></tr>') : '<tr><td colspan="3" class="empty">Loading…</td></tr>'}</tbody></table></div></section>`;
    const render = (s) => {
      if (s.missing) return `<div class="users-page projects-page"><section class="panel"><div class="empty" style="padding:40px 18px"><b>Project not found</b><br>It doesn't exist, was moved to the trash, or you can't see it.<br><br><a class="py-btn py-btn--secondary" href="#/p/${esc(ctx.slug)}/projects">Back to projects</a></div></section></div>`;
      if (!s.meta) return `<div class="users-page projects-page tasks-page">${s.error ? alertBox(s.error) : '<p class="py-caption">Loading tasks…</p>'}</div>`;
      const m = s.meta;
      return `<div class="users-page projects-page tasks-page">
        <a class="back" href="#/p/${esc(ctx.slug)}/projects">${icon('arrow-left')}All projects</a>
        <div class="page-title"><div><div class="ov-key"><span class="key">${esc(m.project.key)}</span><span class="chip-vis" title="The task layout decides the statuses and extra fields">${icon('layers')}${esc(m.layoutName)}</span></div><h1>${esc(m.project.name)}</h1></div></div>
        <div id="ptabs-host">${Projects.tabs(ctx, projectId, 'tasks', s.count ?? null)}</div>
        ${s.error ? alertBox(s.error) : ''}${s.trashView && s.notice ? `<div class="py-alert py-alert--ok" role="status" id="notice">${icon('check')}<span>${esc(s.notice)}</span></div>` : ''}
        ${s.trashView ? trashHtml() : '<div id="tv-host"></div>'}
      </div>`;
    };
    let api;
    const load = async () => {
      const pre = s.pre; s.pre = null;
      const [data, lists, people] = pre ? [pre.data, pre.lists, s.people] : await Promise.all([Store.tasks(portalId, projectId, {}), Store.taskLists(portalId, projectId), s.people.length ? s.people : Store.projectPeople(portalId)]);
      s.people = people; s.count = lists.reduce((n, l) => n + l.taskCount, 0);
      s.meta = { project: data.project, layoutName: data.layoutName, canManageLists: data.canManageLists, canRestore: data.canRestore };
      return { tasks: data.tasks, projects: [{ id: projectId, key: data.project.key, name: data.project.name, canCreate: data.canCreate, canEdit: data.canEdit, statuses: data.statuses }], lists, people };
    };
    const mountEngine = () => {
      engine?.destroy();
      engine = TaskList.mount(el.querySelector('#tv-host'), { ctx, key: `project:${projectId}`, state: s.state, defaultGroup: 'status', groups: ['status', 'list', 'owner', 'priority', 'due', 'none'], lockedProject: projectId, load, notice: takeNotice(),
        emptyHint: 'No tasks yet. Add the first one with the New task button.', from: '',
        onData: (D) => { const h = el.querySelector('#ptabs-host'); s.count = D.lists.reduce((n, l) => n + l.taskCount, 0); if (h) h.innerHTML = Projects.tabs(ctx, projectId, 'tasks', s.count); },
        extra: () => `${s.meta?.canManageLists ? `<button class="tb" type="button" id="lists-menu" aria-haspopup="true">${TaskList.ic('stack')}Lists</button>` : ''}<button class="tb" type="button" id="toggle-trash" aria-pressed="false">${icon('log-out')}Trash</button>`,
        wire: (host) => { host.querySelector('#toggle-trash')?.addEventListener('click', toggleTrash); host.querySelector('#lists-menu')?.addEventListener('click', (e) => listsMenu(e.currentTarget)); } });
    };
    const takeNotice = () => { const n = s.notice; s.notice = null; return n; };
    const toggleTrash = async () => {
      s.trashView = !s.trashView; s.trash = null; if (s.trashView) { engine?.destroy(); engine = null; s.notice = null; }
      api.paint();
      if (s.trashView) { try { s.trash = (await Store.tasks(portalId, projectId, { trashed: true })).tasks; } catch (err) { s.error = err.message; } api.paint(); }
    };
    /* ----- the Lists menu: reorder, rename, archive, new list ----- */
    function listsMenu(anchor) {
      const note = (m) => engine.setNotice(m);
      const run = async (fn, msg) => { try { await fn(); if (msg) note(msg); } catch (err) { TaskList.toast(err.message); } await engine.refresh(); };
      TaskList.pop(anchor, { cls: 'lmenu', draw: (menu, close) => {
        const draw = () => {
          const L = engine.data().lists;
          menu.innerHTML = `<div class="pop-t">Task lists</div>${L.map((l) => `<div class="lrow${l.archived ? ' archived' : ''}" data-lid="${esc(l.id)}"><span class="ln">${esc(l.name)}${l.isDefault ? '<span class="chip">Default</span>' : ''}${l.flag === 'EXTERNAL' ? '<span class="chip">External</span>' : ''}${l.archived ? '<span class="chip">Archived</span>' : ''}<small>${l.openCount} open · ${l.taskCount} total</small></span>
            <span class="lacts"><button class="icon-x" type="button" data-list-up="${esc(l.id)}" aria-label="Move ${esc(l.name)} up" title="Move up">↑</button><button class="icon-x" type="button" data-list-down="${esc(l.id)}" aria-label="Move ${esc(l.name)} down" title="Move down">↓</button>
            <button class="py-btn py-btn--ghost sm" type="button" data-list-rename="${esc(l.id)}">Rename</button>${l.archived ? `<button class="py-btn py-btn--ghost sm" type="button" data-list-unarchive="${esc(l.id)}">Unarchive</button>` : l.isDefault ? '' : `<button class="py-btn py-btn--ghost sm" type="button" data-list-archive="${esc(l.id)}">Archive</button>`}</span></div>`).join('')}
            <div class="pop-f"><button class="py-btn py-btn--secondary sm" type="button" id="new-list">${icon('plus')}New list</button></div>`;
        };
        draw();
        menu.addEventListener('click', async (e) => {
          const T = (sel) => e.target.closest(sel), L = () => engine.data().lists, byId = (id) => L().find((x) => x.id === id);
          let b;
          if ((b = T('[data-list-up]'))) { await run(() => Store.moveTaskList(portalId, b.dataset.listUp, -1)); return draw(); }
          if ((b = T('[data-list-down]'))) { await run(() => Store.moveTaskList(portalId, b.dataset.listDown, 1)); return draw(); }
          if ((b = T('[data-list-archive]'))) { const l = byId(b.dataset.listArchive); await run(() => Store.archiveTaskList(portalId, l.id, true), `${l.name} archived. Its tasks are kept.`); return draw(); }
          if ((b = T('[data-list-unarchive]'))) { const l = byId(b.dataset.listUnarchive); await run(() => Store.archiveTaskList(portalId, l.id, false), `${l.name} is active again.`); return draw(); }
          if ((b = T('[data-list-rename]'))) {
            const l = byId(b.dataset.listRename); close();
            formDialog({ title: `Rename ${l.name}`, label: 'Save', body: `${field({ label: 'Name', id: 'tl-name', body: input({ id: 'tl-name', name: 'name', value: l.name, autocomplete: 'off' }) })}
              ${field({ label: 'Visibility', id: 'tl-flag', body: `<select id="tl-flag" name="flag" class="py-select"><option value="INTERNAL" ${l.flag === 'INTERNAL' ? 'selected' : ''}>Internal</option><option value="EXTERNAL" ${l.flag === 'EXTERNAL' ? 'selected' : ''}>External</option></select>` })}`,
              onSubmit: async (f) => { await Store.updateTaskList(portalId, l.id, { name: f.name.value, flag: f.flag.value }); note(`List renamed to ${f.name.value.trim()}.`); await engine.refresh(); } });
            return;
          }
          if (T('#new-list')) {
            close();
            formDialog({ title: 'New task list', lead: 'Lists group tasks, like Design or Build. Every project also has a General list.', label: 'Create list',
              body: `${field({ label: 'Name', id: 'tl-name', body: input({ id: 'tl-name', name: 'name', placeholder: 'e.g. Build', autocomplete: 'off' }) })}
                ${field({ label: 'Visibility', id: 'tl-flag', hint: 'External lists are visible to client users.', body: '<select id="tl-flag" name="flag" class="py-select"><option value="INTERNAL">Internal</option><option value="EXTERNAL">External</option></select>' })}`,
              onSubmit: async (f) => { await Store.createTaskList(portalId, projectId, { name: f.name.value, flag: f.flag.value }); note(`List ${f.name.value.trim()} created.`); await engine.refresh(); } });
          }
        });
      } });
    }
    api = component(el, s, render, () => {
      if (!s.meta) return;
      el.querySelectorAll('#toggle-trash').forEach((b) => { if (s.trashView) b.addEventListener('click', toggleTrash); });
      el.querySelectorAll('[data-restore]').forEach((b) => b.addEventListener('click', async () => {
        try { const t = s.trash.find((x) => x.id === b.dataset.restore); await Store.restoreTask(portalId, b.dataset.restore); s.notice = `${t.key} restored.`; s.trash = (await Store.tasks(portalId, projectId, { trashed: true })).tasks; s.error = null; } catch (err) { s.error = err.message; }
        api.paint();
      }));
      if (!s.trashView && !engine) mountEngine();
    });
    /* first load: the project chrome needs the project name, so fetch once and hand the result to the engine */
    (async () => {
      try {
        const [data, lists, people] = await Promise.all([Store.tasks(portalId, projectId, {}), Store.taskLists(portalId, projectId), Store.projectPeople(portalId)]);
        s.people = people; s.pre = { data, lists }; s.count = lists.reduce((n, l) => n + l.taskCount, 0);
        s.meta = { project: data.project, layoutName: data.layoutName, canManageLists: data.canManageLists, canRestore: data.canRestore };
      } catch (err) { if (err.code === 'PROJECT_NOT_FOUND') s.missing = true; else s.error = err.message; }
      api.paint();
    })();
  }

  /* ======================= task detail (full page and peek panel) ======================= */
  /** opts.peek: render for the side panel (no breadcrumb, properties under the title); opts.onTrashed(msg), opts.onOpen(taskId) (subtask click) belong to the peek host. */
  function detail(el, ctx, opts = {}) {
    const peek = !!opts.peek;
    const projectId = ctx.params.id, taskId = ctx.params.tid, portalId = ctx.portal.id;
    /* opened from the portal Tasks module: the back link returns there (?from=tasks | tasks-all) */
    const from = ['tasks', 'tasks-all'].includes(ctx.query.from) ? ctx.query.from : '';
    const backUrl = from ? `#/p/${ctx.slug}/tasks${from === 'tasks-all' ? '?tab=all' : ''}` : `${base(ctx, projectId)}/tasks`;
    const backText = (t) => (from ? (from === 'tasks-all' ? 'All Tasks' : 'My Tasks') : `${t.project.name} · Tasks`);
    const mkUi = () => ({ pop: null, q: '', cal: null, editing: null, error: null, flash: null, off: null });
    const s = { t: null, people: [], tags: [], uiCore: mkUi(), uiDesc: mkUi(), ui: mkUi(), error: null, notice: peek ? null : takeFlash(), missing: false, busy: false,
      editTitle: false, titleErr: null, subErr: null, subText: '', comment: '', commentErr: null, editingComment: null, editText: '', editErr: null, tagErr: null };
    const PRIOS = Store.TASK_PRIORITIES.map(([id, label]) => ({ id, label, active: true }));
    const person = (list) => list.map((x) => ({ id: x.userId, label: x.fullName, active: true }));
    /** The standard properties as pickers; a field's apiName is the key it saves under. */
    const coreFields = (t) => [
      { apiName: 'statusId', label: 'Status', type: 'PICKLIST', mandatory: true, readOnly: false, config: {}, options: t.statuses.map((x) => ({ id: x.id, label: `${x.name} (${x.type === 'CLOSED' ? 'Closed' : 'Open'})`, active: true })) },
      { apiName: 'priority', label: 'Priority', type: 'PICKLIST', mandatory: true, readOnly: false, config: {}, options: PRIOS },
      { apiName: 'ownerIds', label: 'Owners', type: 'MULTI_PICKLIST', mandatory: false, readOnly: false, wide: false, config: {}, options: person(s.people) },
      { apiName: 'startDate', label: 'Start date', type: 'DATE', mandatory: false, readOnly: false, config: {}, options: [] },
      { apiName: 'dueDate', label: 'Due date', type: 'DATE', mandatory: false, readOnly: false, config: {}, options: [] },
      { apiName: 'workHours', label: 'Work hours', type: 'DECIMAL', mandatory: false, readOnly: false, config: { min: 0, decimals: 2 }, options: [] },
      { apiName: 'completion', label: 'Completion (%)', type: 'NUMBER', mandatory: true, readOnly: t.closed, readOnlyReason: 'A closed task is 100% complete. Reopen it to change this.', config: { min: 0, max: 100 }, options: [] },
      ...(t.parentId ? [] : [{ apiName: 'listId', label: 'List', type: 'PICKLIST', mandatory: true, readOnly: false, config: {}, options: t.lists.map((l) => ({ id: l.id, label: l.name, active: true })) }]),
    ];
    const coreValues = (t) => ({ statusId: t.statusId, priority: t.priority, ownerIds: t.ownerIds, startDate: t.startDate, dueDate: t.dueDate, workHours: t.workHours, completion: t.completion, listId: t.list.id });
    const descField = () => [{ apiName: 'description', label: 'Description', type: 'LONG_TEXT', mandatory: false, readOnly: false, wide: true, config: { maxLength: 10000 }, options: [] }];
    const sections = (t) => t.layout.sections.filter((x) => x.fields.length);
    const asCtx = () => ({ ...ctx, editHint: 'You can read this task, but only project members can change it' });

    const actHtml = (a) => {
      const fmt = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? day(v, ctx) : v);
      let body;
      if (a.action === 'STATUS') body = `changed the status from <b>${esc(a.from)}</b> to <b>${esc(a.to)}</b>`;
      else if (a.action === 'FIELD' && a.text) body = esc(a.text.toLowerCase());
      else if (a.action === 'FIELD') body = a.from == null ? `${esc(a.to)} (<b>${esc(a.field)}</b>)` : `changed <b>${esc(a.field)}</b> from ${esc(fmt(a.from))} to <b>${esc(fmt(a.to))}</b>`;
      else body = esc((a.text || '').charAt(0).toLowerCase() + (a.text || '').slice(1));
      return `<li class="ev">${TaskList.avatar(a.actorName, 18)}<span class="evt"><strong>${esc(a.actorName)}</strong> ${body}</span><small class="when">${esc(when(a.at, ctx))}</small></li>`;
    };
    const subRow = (k) => `<li class="srow2${k.closed ? ' done' : ''}"><a class="sublink" href="${taskHref(ctx, projectId, k.id, from)}" data-sub="${esc(k.id)}"><span class="si" title="${esc(k.status.name)}">${TaskList.statusIcon(k.status)}</span><span class="mono">${esc(k.key)}</span><span class="tt">${esc(k.title)}</span>${subCount(k)}</a><span class="so">${TaskList.ownerStack(k.owners, 18)}</span><span class="so due-s">${dueCell(k, ctx)}</span></li>`;
    const commentHtml = (c) => `<li class="cmt" data-comment="${esc(c.id)}">${TaskList.avatar(c.authorName, 22)}<div class="cb">
        <div class="ch"><strong>${esc(c.authorName)}</strong><small>${esc(when(c.createdAt, ctx))}${c.editedAt ? ' · <span class="edited">edited</span>' : ''}</small>
          ${(c.mine || c.canDelete) && !s.t.trashed ? `<span class="cacts">${c.mine ? `<button class="py-btn py-btn--ghost sm" type="button" data-cedit="${esc(c.id)}">Edit</button>` : ''}${c.canDelete ? `<button class="py-btn py-btn--ghost sm danger" type="button" data-cdel="${esc(c.id)}">Delete</button>` : ''}</span>` : ''}</div>
        ${s.editingComment === c.id ? `<textarea class="py-textarea" id="edit-comment" rows="3" aria-label="Edit comment">${esc(s.editText)}</textarea>${s.editErr ? `<p class="py-field__error">${icon('alert')}${esc(s.editErr)}</p>` : ''}<div class="cform-acts"><button class="py-btn py-btn--primary" type="button" id="save-comment">Save</button><button class="py-btn py-btn--ghost" type="button" id="cancel-comment">Cancel</button></div>` : `<p class="cbody">${esc(c.body)}</p>`}</div></li>`;
    /** The properties column: core properties, the layout's custom fields, tags, followers. */
    const sideHtml = (t) => {
      const free = s.people.filter((x) => !t.followers.some((f) => f.id === x.userId));
      return `<h4>Properties</h4><div class="cf-props one" id="t-core">${CustomFields.propsHtml(coreFields(t), coreValues(t), s.uiCore, asCtx(), s.people, t.canEdit)}</div>
        ${sections(t).length ? `<div id="t-custom" class="cf-sections">${sections(t).map((sec) => `<h4>${esc(sec.name)}</h4><div class="cf-props one">${CustomFields.propsHtml(sec.fields, t.customValues, s.ui, asCtx(), s.people, t.canEdit)}</div>`).join('')}</div>` : ''}
        <h4>Tags</h4><div class="tags-box" id="tags"><span class="tagrow">${t.tags.map((x) => `<span class="tag lg">${esc(x)}${t.canEdit ? `<button type="button" class="tag-x" data-tag-del="${esc(x)}" aria-label="Remove tag ${esc(x)}">✕</button>` : ''}</span>`).join('') || '<span class="muted">No tags</span>'}</span>
          ${t.canEdit ? `<form id="tag-form" novalidate><input type="text" name="tag" list="tag-list" placeholder="Add a tag" aria-label="Add a tag" maxlength="${Store.TAG_LENGTH + 5}" autocomplete="off"><datalist id="tag-list">${s.tags.filter((x) => !t.tags.some((y) => y.toLowerCase() === x.toLowerCase())).map((x) => `<option value="${esc(x)}">`).join('')}</datalist></form>${s.tagErr ? `<p class="py-field__error">${icon('alert')}${esc(s.tagErr)}</p>` : ''}` : ''}</div>
        <h4>Followers <span class="muted">${plural(t.followers.length, 'person')}</span></h4>
        <ul class="followers" id="followers">${t.followers.map((f) => `<li>${TaskList.avatar(f.name, 20)}<span class="fn">${esc(f.name)}${f.id === ctx.me.id ? '<span class="you"> (you)</span>' : ''}</span>${(t.canEdit || f.id === ctx.me.id) && !t.trashed ? `<button class="icon-x" type="button" data-unfollow="${esc(f.id)}" aria-label="Remove ${esc(f.name)} from followers" title="Remove">✕</button>` : ''}</li>`).join('') || '<li class="muted">Nobody follows this task.</li>'}</ul>
        ${t.canEdit && free.length ? `<form class="add-member" id="add-follower" novalidate><select class="py-select" name="userId" aria-label="Add a follower"><option value="">Add a follower…</option>${free.map((x) => `<option value="${esc(x.userId)}">${esc(x.fullName)}</option>`).join('')}</select></form>` : ''}`;
    };

    const render = (s) => {
      if (s.missing) return `<div class="users-page projects-page tasks-page"><section class="panel"><div class="empty" style="padding:40px 18px"><b>Task not found</b><br>It doesn't exist, or you can't see it.<br><br>${peek ? '' : `<a class="py-btn py-btn--secondary" href="${backUrl}">Back to tasks</a>`}</div></section></div>`;
      const t = s.t;
      if (!t) return `<div class="users-page projects-page tasks-page"><p class="py-caption">Loading task…</p></div>`;
      const ro = !t.canEdit;
      const events = [...t.activity.filter((a) => a.action !== 'COMMENT').map((a) => ({ at: a.at, html: actHtml(a) })), ...t.comments.map((c) => ({ at: c.createdAt, html: commentHtml(c) }))].sort((x, y) => x.at - y.at);
      const done = t.subtasks.filter((k) => k.closed).length;
      return `<div class="users-page projects-page tasks-page detail td${peek ? ' peek' : ''}">
        ${peek ? '' : `<nav class="crumbs" aria-label="Breadcrumb"><a href="${backUrl}" id="back-link">${icon('arrow-left')}${esc(backText(t))}</a>${from ? `<span aria-hidden="true">/</span><a href="${base(ctx, projectId)}/tasks">${esc(t.project.name)}</a>` : ''}${t.ancestors.map((a) => `<span aria-hidden="true">/</span><a href="${taskHref(ctx, projectId, a.id, from)}" class="mono">${esc(a.key)}</a>`).join('')}</nav>`}
        ${s.error ? alertBox(s.error) : ''}${s.notice ? `<div class="py-alert py-alert--ok" role="status" ${peek ? '' : 'id="notice"'}>${icon('check')}<span>${esc(s.notice)}</span></div>` : ''}
        ${t.trashed ? `<div class="py-alert" role="status" id="trash-banner">${icon('alert')}<span>This task is in the trash${t.deletedBy ? `, deleted by ${esc(t.deletedBy)} on ${esc(when(t.deletedAt, ctx))}` : ''}. It is read-only until restored.${t.trashedWithParent ? ' It was trashed together with its parent task.' : ''}</span>${t.canRestore ? '<button class="py-btn py-btn--secondary" type="button" id="restore">Restore</button>' : ''}</div>` : ''}
        ${ro && !t.trashed ? `<div class="py-alert" role="status">${icon('alert')}<span>You can read this task, but only project members with edit rights can change it.</span></div>` : ''}
        <div class="td-main"><div class="td-center">
          <div class="td-head"><div class="ov-key"><span class="key" id="t-key">${esc(t.key)}</span>${statusChip(t.status)}<span class="chip-vis" title="The task layout decides the statuses and extra fields">${icon('layers')}${esc(t.layout.name)}</span>${t.ancestors.length ? `<span class="chip-vis">Subtask, level ${t.depth}</span>` : ''}
              <span class="grow"></span><button class="py-btn py-btn--ghost sm" type="button" id="follow" aria-pressed="${t.isFollowing}">${t.isFollowing ? 'Unfollow' : 'Follow'}</button>${t.canDelete ? `<button class="py-btn py-btn--ghost sm danger" type="button" id="trash">${icon('log-out')}Delete</button>` : ''}</div>
            ${s.editTitle && t.canEdit ? `<input class="t-title-input" id="title-input" value="${esc(t.title)}" maxlength="${Store.TITLE_MAX}" aria-label="Task title">${s.titleErr ? `<p class="py-field__error">${icon('alert')}${esc(s.titleErr)}</p>` : ''}`
              : t.canEdit ? `<h1 class="t-title"><button type="button" class="t-title-btn" id="title-btn" title="Click to edit the title">${esc(t.title)}</button></h1>` : `<h1 class="t-title">${esc(t.title)}</h1>`}
            <p class="td-meta">Created by ${esc(t.createdBy.name)} · ${esc(when(t.createdAt, ctx))}${t.closedAt ? ` · Closed ${esc(when(t.closedAt, ctx))}` : ''}</p></div>
          ${peek ? `<aside class="td-side in-peek">${sideHtml(t)}</aside>` : ''}
          <div class="cf-props td-desc" id="t-desc">${CustomFields.propsHtml(descField(), { description: t.description }, s.uiDesc, asCtx(), s.people, t.canEdit)}</div>
          <section class="td-sec" id="subtasks"><h2>Sub-tasks ${t.subtasks.length ? `<span class="muted">${done}/${t.subtasks.length}</span><span class="prog" title="${done} of ${t.subtasks.length} closed"><i style="width:${Math.round((done / t.subtasks.length) * 100)}%"></i></span>` : ''}</h2>
            ${t.subtasks.length ? `<ul class="sublist">${t.subtasks.map(subRow).join('')}</ul>` : ''}
            ${t.canCreate ? (t.depth >= t.maxDepth ? `<p class="hint">Subtasks go ${t.maxDepth} levels deep at most. Add the next task one level up.</p>`
              : `<form class="qadd" id="sub-add" novalidate><span class="plus" aria-hidden="true">${TaskList.ic('plus', 13)}</span><input type="text" name="title" placeholder="Add a sub-task and press Enter" aria-label="Add a subtask" maxlength="${Store.TITLE_MAX}" autocomplete="off" value="${esc(s.subText)}">${s.subErr ? `<p class="py-field__error">${icon('alert')}${esc(s.subErr)}</p>` : ''}</form>`) : ''}</section>
          <section class="td-sec" id="discussion"><h2>Activity</h2>
            <ul class="tl" id="activity">${events.map((e) => e.html).join('')}</ul>
            ${t.canComment ? `<form class="cbox" id="comment-form" novalidate><textarea class="py-textarea" id="new-comment" rows="2" placeholder="Leave a comment…" aria-label="New comment">${esc(s.comment)}</textarea>${s.commentErr ? `<p class="py-field__error">${icon('alert')}${esc(s.commentErr)}</p>` : ''}<div class="cform-acts"><button class="py-btn py-btn--primary" type="submit" id="add-comment" ${s.busy ? 'disabled' : ''}>Comment</button></div></form>` : '<p class="hint">Only project members can comment.</p>'}</section>
        </div>${peek ? '' : `<aside class="td-side">${sideHtml(t)}</aside>`}</div></div>`;
    };

    let api;
    const reload = async () => { try { s.t = await Store.task(portalId, taskId); } catch (err) { if (err.code === 'TASK_NOT_FOUND') s.missing = true; else s.error = err.message; } api.paint(); };
    const run = async (fn, notice) => { s.error = null; s.notice = null; try { await fn(); if (notice) s.notice = notice; } catch (err) { s.error = err.message; } await reload(); };
    /** One save path for the properties: status goes through the status rule (with the open-subtasks confirmation), the rest is a partial update. */
    const saveCore = async (k, v, optimistic) => {
      if (k === 'statusId') {
        try { await Store.setTaskStatus(portalId, taskId, v); }
        catch (err) {
          if (err.code !== 'OPEN_SUBTASKS') throw err;
          let ok = false;
          await new Promise((res) => formDialog({ title: `Close ${s.t.key}?`, label: 'Close it anyway', lead: esc(err.message), onSubmit: async () => { ok = true; }, onClose: res }));
          if (ok) await Store.setTaskStatus(portalId, taskId, v, { confirm: true });
        }
      } else {
        const t = s.t, prev = k === 'listId' ? t.list.id : t[k];
        const val = k === 'completion' || k === 'workHours' ? (v == null ? null : Number(v)) : v;
        if (optimistic && k !== 'listId') { t[k] = val ?? (k === 'ownerIds' ? [] : null); api.paint(); }
        try { await Store.updateTask(portalId, taskId, { [k]: val }); }
        catch (err) { if (optimistic && k !== 'listId') t[k] = prev; throw err; }
      }
      s.t = await Store.task(portalId, taskId);
    };
    api = component(el, s, render, (el) => {
      if (!s.t) return;
      const t = s.t;
      if (t.canEdit) {
        CustomFields.bindProps(el.querySelector('#t-core'), { fields: coreFields(t), values: coreValues(t), ui: s.uiCore, people: s.people, repaint: () => api.paint(), save: saveCore });
        CustomFields.bindProps(el.querySelector('#t-desc'), { fields: descField(), values: { description: t.description }, ui: s.uiDesc, people: s.people, repaint: () => api.paint(),
          save: async (k, v) => { await Store.updateTask(portalId, taskId, { description: v ?? '' }); s.t = await Store.task(portalId, taskId); } });
        if (sections(t).length) CustomFields.bindProps(el.querySelector('#t-custom'), { fields: sections(t).flatMap((x) => x.fields), values: t.customValues || {}, ui: s.ui, people: s.people, repaint: () => api.paint(),
          save: async (k, v) => { await Store.setTaskCustomValue(portalId, taskId, k, v); s.t = await Store.task(portalId, taskId); } });
      }
      /* title */
      el.querySelector('#title-btn')?.addEventListener('click', () => { s.editTitle = true; s.titleErr = null; api.paint(); const i = el.querySelector('#title-input'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); });
      const ti = el.querySelector('#title-input');
      if (ti) {
        ti.focus(); let done = false;
        const finish = async (save) => {
          if (done) return; done = true;
          if (!save || ti.value.trim() === t.title) { s.editTitle = false; s.titleErr = null; return api.paint(); }
          try { await Store.updateTask(portalId, taskId, { title: ti.value }); s.editTitle = false; s.titleErr = null; s.t = await Store.task(portalId, taskId); }
          catch (err) { s.titleErr = err.message; done = false; }
          api.paint();
        };
        ti.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); finish(true); } else if (e.key === 'Escape') { e.stopPropagation(); finish(false); } });
        ti.addEventListener('blur', () => finish(true));
      }
      /* top actions */
      el.querySelector('#follow')?.addEventListener('click', () => run(() => (t.isFollowing ? Store.removeTaskFollower(portalId, taskId, ctx.me.id) : Store.addTaskFollower(portalId, taskId, ctx.me.id)), t.isFollowing ? 'You unfollowed this task.' : 'You follow this task.'));
      el.querySelector('#trash')?.addEventListener('click', () => CustomFields.confirmDialog({ title: `Delete ${t.key}?`, label: 'Move to trash',
        body: `${t.subtasks.length ? `It moves to the trash with its ${plural(t.subtasks.length, 'subtask')}. ` : 'It moves to the trash. '}Restore it from the project's Tasks → Trash.`,
        onConfirm: async () => { await Store.trashTask(portalId, taskId); if (peek) return opts.onTrashed?.(`${t.key} moved to the trash.`); flash = `${t.key} moved to the trash.`; Router.navigate(backUrl.slice(1)); } }));
      el.querySelector('#restore')?.addEventListener('click', () => run(() => Store.restoreTask(portalId, taskId), `${t.key} restored.`));
      /* subtasks */
      if (peek) el.querySelectorAll('[data-sub]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); opts.onOpen?.(a.dataset.sub); }));
      const sub = el.querySelector('#sub-add');
      sub?.addEventListener('submit', async (e) => {
        e.preventDefault(); const title = sub.title.value; if (!title.trim()) return; s.subErr = null; s.subText = '';
        sub.title.disabled = true;
        try { await Store.createTask(portalId, projectId, { title, parentId: taskId }); s.t = await Store.task(portalId, taskId); }
        catch (err) { s.subErr = err.message; s.subText = title; }
        api.paint(); el.querySelector('#sub-add input')?.focus();
      });
      /* comments */
      el.querySelector('#new-comment')?.addEventListener('input', (e) => { s.comment = e.target.value; });
      el.querySelector('#new-comment')?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); el.querySelector('#comment-form').requestSubmit(); } });
      el.querySelector('#comment-form')?.addEventListener('submit', async (e) => {
        e.preventDefault(); s.commentErr = null; s.busy = true; api.paint();
        try { await Store.addTaskComment(portalId, taskId, s.comment); s.comment = ''; s.t = await Store.task(portalId, taskId); } catch (err) { s.commentErr = err.message; }
        s.busy = false; api.paint();
      });
      el.querySelectorAll('[data-cedit]').forEach((b) => b.addEventListener('click', () => { const c = t.comments.find((x) => x.id === b.dataset.cedit); s.editingComment = c.id; s.editText = c.body; s.editErr = null; api.paint(); el.querySelector('#edit-comment').focus(); }));
      el.querySelector('#edit-comment')?.addEventListener('input', (e) => { s.editText = e.target.value; });
      el.querySelector('#cancel-comment')?.addEventListener('click', () => { s.editingComment = null; api.paint(); });
      el.querySelector('#save-comment')?.addEventListener('click', async () => {
        try { await Store.updateTaskComment(portalId, s.editingComment, s.editText); s.editingComment = null; s.editErr = null; s.t = await Store.task(portalId, taskId); } catch (err) { s.editErr = err.message; }
        api.paint();
      });
      el.querySelectorAll('[data-cdel]').forEach((b) => b.addEventListener('click', () => CustomFields.confirmDialog({ title: 'Delete this comment?', label: 'Delete comment', body: 'This removes the comment for everyone.',
        onConfirm: async () => { await Store.deleteTaskComment(portalId, b.dataset.cdel); s.t = await Store.task(portalId, taskId); api.paint(); } })));
      /* tags */
      el.querySelector('#tag-form')?.addEventListener('submit', async (e) => {
        e.preventDefault(); const v = e.target.tag.value.trim(); if (!v) return; s.tagErr = null; e.target.tag.disabled = true;
        try { await Store.updateTask(portalId, taskId, { tags: [...t.tags, v] }); s.t = await Store.task(portalId, taskId); s.tags = await Store.taskTags(portalId); } catch (err) { s.tagErr = err.message; }
        api.paint(); el.querySelector('#tag-form input')?.focus();
      });
      el.querySelectorAll('[data-tag-del]').forEach((b) => b.addEventListener('click', () => run(() => Store.updateTask(portalId, taskId, { tags: t.tags.filter((x) => x !== b.dataset.tagDel) }))));
      /* followers */
      el.querySelectorAll('[data-unfollow]').forEach((b) => b.addEventListener('click', () => run(() => Store.removeTaskFollower(portalId, taskId, b.dataset.unfollow))));
      el.querySelector('#add-follower select')?.addEventListener('change', (e) => { if (e.target.value) run(() => Store.addTaskFollower(portalId, taskId, e.target.value)); });
    });
    /* Ctrl+K on the full page (in the peek the list screen owns it) */
    if (!peek) {
      const onKey = (e) => {
        if (!el.isConnected) return document.removeEventListener('keydown', onKey);
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); TaskList.palette({ ctx, openTask: () => {}, commands: [] }); }
      };
      document.addEventListener('keydown', onKey);
    }
    (async () => {
      try { [s.people, s.tags] = await Promise.all([Store.projectPeople(portalId), Store.taskTags(portalId)]); } catch (err) { /* names still show */ }
      await reload();
    })();
  }

  const ui = { formDialog, takeFlash, plural, taskHref };
  return { tab, detail, ui };
})();
