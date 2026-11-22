/*
 * Settings (frontend/src/app/features/settings/**): Portal (PTL-US-02), Users, and My preferences (PTL-US-12).
 */
const Settings = (() => {
  const { esc, icon, spinner, field, input, alertBox, initials, component, formatDate, Router } = PY;
  const LOCAL_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const now = new Date();
  const options = (items, selected) => items.map(([value, label]) => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`).join('');
  const sync = (el, s, onChange) => el.querySelectorAll('[name]').forEach((n) => n.addEventListener('input', () => { s[n.name] = n.type === 'checkbox' ? n.checked : n.value; if (onChange) onChange(n.name); }));

  /** The page frame: heading + tabs, then the active tab's content. */
  function page(el, ctx, tab, mountTab) {
    const base = `#/p/${ctx.portal.slug}/settings`;
    el.innerHTML = `<div class="settings-head"><h1>Settings</h1><p>${esc(ctx.portal.name)}: regional settings, people, and your own preferences.</p></div>
      <nav class="settings-tabs" aria-label="Settings sections">
        <a href="${base}/portal" class="${tab === 'portal' ? 'active' : ''}">Portal</a>
        ${ctx.can('USERS_VIEW') ? `<a href="${base}/users" class="${tab === 'users' ? 'active' : ''}">Users</a>` : ''}
        ${ctx.can('AUDIT_VIEW') ? `<a href="${base}/audit" class="${tab === 'audit' ? 'active' : ''}">Audit log</a>` : ''}
        <a href="${base}/preferences" class="${tab === 'preferences' ? 'active' : ''}">My preferences</a>
      </nav><div id="tab"></div>`;
    mountTab(el.querySelector('#tab'), ctx);
  }

  /* ---------- Portal ---------- */
  function portalTab(el, ctx) {
    const canManage = ctx.can('PORTAL_SETTINGS_MANAGE');
    const p = ctx.portal;
    const s = { timeZone: p.timeZone, dateFormat: p.dateFormat, currency: p.currency, weekStart: p.weekStart, busy: false, saved: false, dirty: false, error: null };
    const preview = () => formatDate(now, `${s.dateFormat}, h:mm a`, s.timeZone);
    const render = (s) => `<div class="settings-card"><section class="card">
      <h2>Regional settings</h2>
      <p>Dates are stored in UTC and shown in each person's time zone, or this one if they haven't set their own.</p>
      ${!canManage ? alertBox('Only Admins can change these settings.', 'error').replace('role="alert"', 'role="status"') : ''}
      ${s.error ? alertBox(s.error) : ''}
      <form novalidate>
        <div class="grid">
          ${field({ label: 'Time zone', id: 'ps-tz', body: `<select id="ps-tz" name="timeZone" class="py-select" ${canManage ? '' : 'disabled'}>${options(PY.timeZoneOptions(p.timeZone).map((z) => [z, z]), s.timeZone)}</select>` })}
          ${field({ label: 'Date format', id: 'ps-format', body: `<select id="ps-format" name="dateFormat" class="py-select" ${canManage ? '' : 'disabled'}>${options(PY.DATE_FORMATS.map((f) => [f, formatDate(now, f, LOCAL_ZONE)]), s.dateFormat)}</select>` })}
          ${field({ label: 'Currency', id: 'ps-currency', body: `<select id="ps-currency" name="currency" class="py-select" ${canManage ? '' : 'disabled'}>${options(PY.currencies.map((c) => [c.code, c.label]), s.currency)}</select>` })}
          ${field({ label: 'Week starts on', id: 'ps-week', body: `<select id="ps-week" name="weekStart" class="py-select" ${canManage ? '' : 'disabled'}>${options(PY.WEEK_STARTS.map((w) => [w.value, w.label]), s.weekStart)}</select>` })}
          <p class="preview full">Right now in this portal: <strong id="ps-preview">${esc(preview())}</strong></p>
        </div>
        <div class="warning" id="ps-warning" ${canManage && s.currency !== p.currency ? '' : 'hidden'}>Changing the currency doesn't convert amounts already entered. The change is recorded in the audit log.</div>
        ${canManage ? `<div class="foot">
          <button class="py-btn py-btn--primary" type="submit" id="ps-save" ${s.busy || !s.dirty ? 'disabled' : ''}>${s.busy ? `${spinner}Saving` : 'Save changes'}</button>
          ${s.saved ? '<span class="saved" role="status">Saved</span>' : ''}</div>` : ''}
      </form></section></div>`;
    component(el, s, render, (el, api) => {
      sync(el, s, () => { // targeted updates keep focus in the select
        s.dirty = true; s.saved = false;
        el.querySelector('#ps-preview').textContent = preview();
        el.querySelector('#ps-warning').hidden = !(canManage && s.currency !== p.currency);
        const save = el.querySelector('#ps-save'); if (save) save.disabled = false;
        el.querySelector('.saved')?.remove();
      });
      el.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!canManage || !s.dirty) return;
        api.set({ busy: true, error: null });
        try {
          const saved = await Store.updatePortal(p.id, { timeZone: s.timeZone, dateFormat: s.dateFormat, currency: s.currency, weekStart: s.weekStart });
          Object.assign(ctx.portal, saved);
          api.set({ busy: false, saved: true, dirty: false });
        } catch (err) { api.set({ busy: false, error: err.message }); }
      });
    });
  }

  /* ---------- My preferences ---------- */
  function preferencesTab(el, ctx) {
    const s = { timeZone: ctx.me.timeZone ?? '', busy: false, saved: false, dirty: false, error: null };
    const preview = () => {
      const zone = s.timeZone || ctx.portal.timeZone || 'UTC';
      return `${formatDate(now, `${ctx.portal.dateFormat}, h:mm a`, zone)} (${zone})`;
    };
    const render = (s) => `<div class="settings-card"><section class="card">
      <h2>My time zone</h2>
      <p>Applies in every portal you belong to. Leave it on the portal default to follow each portal's setting.</p>
      ${s.error ? alertBox(s.error) : ''}
      <form novalidate><div class="grid">
        ${field({ label: 'Time zone', id: 'mp-tz', body: `<select id="mp-tz" name="timeZone" class="py-select"><option value="">Portal default (${esc(ctx.portal.timeZone)})</option>${options(PY.timeZoneOptions(ctx.me.timeZone).map((z) => [z, z]), s.timeZone)}</select>` }).replace('class="py-field"', 'class="py-field full"')}
        <p class="preview full">Dates will show like: <strong id="mp-preview">${esc(preview())}</strong></p>
      </div>
      <div class="foot">
        <button class="py-btn py-btn--primary" type="submit" id="mp-save" ${s.busy || !s.dirty ? 'disabled' : ''}>${s.busy ? `${spinner}Saving` : 'Save changes'}</button>
        ${s.saved ? '<span class="saved" role="status">Saved</span>' : ''}</div></form></section></div>`;
    component(el, s, render, (el, api) => {
      sync(el, s, () => {
        s.dirty = true; s.saved = false;
        el.querySelector('#mp-preview').textContent = preview();
        el.querySelector('#mp-save').disabled = false; el.querySelector('.saved')?.remove();
      });
      el.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!s.dirty) return;
        api.set({ busy: true, error: null });
        try { const me = await Store.updatePreferences(s.timeZone || null); Object.assign(ctx.me, me); api.set({ busy: false, saved: true, dirty: false }); }
        catch (err) { api.set({ busy: false, error: err.message }); }
      });
    });
  }

  /* ---------- Users ---------- */
  function usersTab(el, ctx) {
    const canManage = ctx.can('USERS_MANAGE');
    const portalId = ctx.portal.id;
    const s = { members: null, invitations: [], query: '', status: 'ALL', busyUser: null, confirmUser: null, inviteOpen: false, inviteBusy: false, inviteError: null,
      inviteEmail: '', inviteProfile: 'EMPLOYEE', inviteSubmitted: false, error: null, notice: null };
    const activeCount = () => (s.members || []).filter((m) => m.status === 'ACTIVE').length;
    const visible = () => (s.members || []).filter((m) => (s.status === 'ALL' || m.status === s.status)
      && (!s.query.trim() || `${m.fullName} ${m.email}`.toLowerCase().includes(s.query.trim().toLowerCase())));
    const isSelf = (m) => m.userId === ctx.me.id;
    const date = (t) => formatDate(t, ctx.portal.dateFormat, ctx.timeZone);

    const render = (s) => {
      const rows = visible().map((m) => `<tr class="${m.status === 'DEACTIVATED' ? 'inactive' : ''}">
        <td><div class="person"><span class="py-avatar">${esc(initials(m.fullName))}</span>
          <div><strong>${esc(m.fullName)}${isSelf(m) ? '<span class="you">(you)</span>' : ''}</strong><small>${esc(m.email)}</small></div></div></td>
        <td>${canManage && !m.owner && m.status === 'ACTIVE'
          ? `<select class="py-select profile" aria-label="Profile of ${esc(m.fullName)}" data-profile="${esc(m.userId)}" ${s.busyUser === m.userId ? 'disabled' : ''}>${options(Store.PROFILES.map((p) => [p.id, p.name]), m.profileId)}</select>`
          : `${esc(m.profileName)}${m.owner ? '<span class="chip" title="The owner always stays an active Admin">Owner</span>' : ''}`}</td>
        <td><span class="badge${m.status === 'ACTIVE' ? ' ok' : ''}">${m.status === 'ACTIVE' ? 'Active' : 'Deactivated'}</span></td>
        <td>${m.lastLoginAt ? date(m.lastLoginAt) : 'Never'}</td>
        ${canManage ? `<td class="actions">${!m.owner && !isSelf(m) ? `<button class="py-btn py-btn--ghost" type="button" data-toggle="${esc(m.userId)}" ${s.busyUser === m.userId ? 'disabled' : ''}>${m.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}</button>` : ''}</td>` : ''}</tr>`).join('');
      const cols = canManage ? 5 : 4;
      const body = !s.members ? `<tr><td colspan="${cols}" class="empty">Loading users…</td></tr>` : rows || `<tr><td colspan="${cols}" class="empty">No users match.</td></tr>`;

      const eErr = s.inviteSubmitted && !PY.EMAIL_PATTERN.test(s.inviteEmail.trim()) ? 'Enter an email like name@company.com.' : null;
      return `<div class="users-page">
      ${s.error ? alertBox(s.error) : ''}
      ${s.notice ? `<div class="py-alert py-alert--ok" role="status">${icon('check')}<span>${s.notice.html}</span></div>` : ''}
      <section class="panel">
        <div class="panel-head">
          <div><h2>Users</h2><p>${activeCount()} active of ${s.members?.length ?? 0} in ${esc(ctx.portal.name)}</p></div>
          ${canManage ? `<button class="py-btn py-btn--primary" type="button" id="invite-open">${icon('plus')}Invite people</button>` : ''}
        </div>
        <div class="filters">
          <label class="py-input-wrap search">${icon('search')}<input id="u-search" name="query" placeholder="Search by name or email" aria-label="Search users" value="${esc(s.query)}" /></label>
          <select class="py-select status" name="status" aria-label="Filter by status">${options([['ALL', 'All statuses'], ['ACTIVE', 'Active'], ['DEACTIVATED', 'Deactivated']], s.status)}</select>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>User</th><th>Profile</th><th>Status</th><th>Last active</th>${canManage ? '<th></th>' : ''}</tr></thead>
          <tbody>${body}</tbody></table></div>
      </section>

      ${canManage && s.invitations.length ? `<section class="panel">
        <div class="panel-head"><div><h2>Pending invitations</h2><p>Invitations expire after 7 days.</p></div></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Email</th><th>Profile</th><th>Invited by</th><th>Expires</th><th></th></tr></thead>
          <tbody>${s.invitations.map((i) => `<tr><td>${esc(i.email)}</td><td>${esc(i.profileName)}</td><td>${esc(i.invitedByName)}</td><td>${date(i.expiresAt)}</td>
            <td class="actions"><button class="py-btn py-btn--ghost" type="button" data-resend="${esc(i.id)}">Resend</button>
            <button class="py-btn py-btn--ghost" type="button" data-revoke="${esc(i.id)}">Withdraw</button></td></tr>`).join('')}</tbody></table></div>
      </section>` : ''}

      ${s.confirmUser ? `<div class="overlay" data-overlay><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="deactivate-title">
        <h2 id="deactivate-title">Deactivate ${esc(s.confirmUser.fullName)}?</h2>
        <p>They lose access to ${esc(ctx.portal.name)} immediately. Their past work stays attributed to them, and you can reactivate them later.</p>
        <div class="dialog-actions"><button class="py-btn py-btn--secondary" type="button" data-close>Cancel</button><button class="py-btn py-btn--danger" type="button" id="confirm-deactivate">Deactivate</button></div>
      </section></div>` : ''}

      ${s.inviteOpen ? `<div class="overlay" data-overlay><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="invite-title">
        <h2 id="invite-title">Invite people</h2>
        <p>They get an email with a link to join ${esc(ctx.portal.name)}. The link works for 7 days.</p>
        ${s.inviteError ? alertBox(s.inviteError) : ''}
        <form class="py-form" novalidate>
          ${field({ label: 'Work email', id: 'inv-email', error: eErr, body: input({ id: 'inv-email', name: 'inviteEmail', type: 'email', value: s.inviteEmail, placeholder: 'name@company.com', error: eErr }) })}
          ${field({ label: 'Profile', id: 'inv-profile', body: `<select id="inv-profile" name="inviteProfile" class="py-select">${options(Store.PROFILES.map((p) => [p.id, `${p.name} — ${p.description}`]), s.inviteProfile)}</select>` })}
          <div class="dialog-actions"><button class="py-btn py-btn--secondary" type="button" data-close>Cancel</button>
          <button class="py-btn py-btn--primary" type="submit" ${s.inviteBusy ? 'disabled' : ''}>${s.inviteBusy ? `${spinner}Sending` : 'Send invitation'}</button></div>
        </form></section></div>` : ''}
      </div>`;
    };

    let api;
    /** Repaint but keep the search box focused and its caret, so typing a filter doesn't drop focus. */
    const repaint = () => {
      const had = document.activeElement?.id === 'u-search', pos = document.activeElement?.selectionStart;
      api.paint();
      if (had) { const n = el.querySelector('#u-search'); n.focus(); n.setSelectionRange(pos, pos); }
    };
    const load = async () => {
      try {
        const [members, invitations] = await Promise.all([Store.members(portalId), canManage ? Store.invitations(portalId) : []]);
        s.members = members; s.invitations = invitations; repaint();
      } catch (err) { s.members = s.members || []; s.error = err.message; repaint(); }
    };
    const run = async (userId, fn, notice) => {
      s.busyUser = userId; s.error = null; s.notice = null; repaint();
      try { await fn(); if (notice) s.notice = { html: notice }; } catch (err) { s.error = err.message; }
      s.busyUser = null; s.confirmUser = null; await load();
    };

    api = component(el, s, render, (el) => {
      const closeDialogs = () => { s.confirmUser = null; s.inviteOpen = false; s.inviteError = null; s.inviteSubmitted = false; repaint(); };
      sync(el, s, (name) => { if (name === 'query' || name === 'status') repaint(); });
      el.querySelector('#invite-open')?.addEventListener('click', () => { s.inviteOpen = true; s.inviteEmail = ''; s.notice = null; repaint(); el.querySelector('#inv-email')?.focus(); });
      el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeDialogs));
      el.querySelectorAll('[data-overlay]').forEach((o) => o.addEventListener('click', (e) => { if (e.target === o) closeDialogs(); }));
      el.querySelectorAll('[data-profile]').forEach((sel) => sel.addEventListener('change', () => run(sel.dataset.profile, () => Store.changeProfile(portalId, sel.dataset.profile, sel.value))));
      el.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
        const m = s.members.find((x) => x.userId === b.dataset.toggle);
        if (m.status === 'ACTIVE') { s.confirmUser = m; repaint(); } else run(m.userId, () => Store.setActive(portalId, m.userId, true));
      }));
      el.querySelector('#confirm-deactivate')?.addEventListener('click', () => run(s.confirmUser.userId, () => Store.setActive(portalId, s.confirmUser.userId, false)));
      el.querySelectorAll('[data-resend]').forEach((b) => b.addEventListener('click', async () => {
        try { const r = await Store.resendInvitation(portalId, b.dataset.resend); s.notice = { html: inviteNotice(`Invitation re-sent to ${esc(r.email)}.`, r.token) }; } catch (err) { s.error = err.message; }
        repaint();
      }));
      el.querySelectorAll('[data-revoke]').forEach((b) => b.addEventListener('click', () => run(null, () => Store.revokeInvitation(portalId, b.dataset.revoke), 'Invitation withdrawn.')));
      el.querySelectorAll('[data-invite-link]').forEach((b) => b.addEventListener('click', () => Router.navigate(`/invite?token=${b.dataset.inviteLink}`)));
      el.querySelector('#invite-title')?.closest('section').querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault(); s.inviteSubmitted = true; s.inviteError = null;
        if (!PY.EMAIL_PATTERN.test(s.inviteEmail.trim())) { repaint(); return PY.focusFirstInvalid(el); }
        s.inviteBusy = true; repaint();
        try {
          const inv = await Store.invite(portalId, { email: s.inviteEmail, profileId: s.inviteProfile });
          Object.assign(s, { inviteOpen: false, inviteBusy: false, inviteSubmitted: false, notice: { html: inviteNotice(`Invitation sent to ${esc(inv.email)}.`, inv.token) } });
          await load();
        } catch (err) { s.inviteBusy = false; s.inviteError = err.message; repaint(); }
      });
    });
    /** The notice carries a prototype-only button that stands in for the email's link. */
    function inviteNotice(text, token) {
      return `${text} <button class="py-link-btn" type="button" data-invite-link="${esc(token)}" title="Prototype only: stands in for clicking the link in the email">Dev: open the invitation link</button>`;
    }
    load();
  }

  /* ---------- Audit log (GET /api/audit-events, AUDIT_VIEW) ---------- */
  function auditTab(el, ctx) {
    const ACTION_LABELS = Object.fromEntries(Store.auditActions());
    const s = { data: null, action: '', page: 0, size: 25, error: null };
    const when = (t) => formatDate(t, `${ctx.portal.dateFormat}, h:mm a`, ctx.timeZone);
    const render = (s) => {
      const d = s.data;
      const rows = d ? d.items.map((e) => `<tr>
        <td class="nowrap">${esc(when(e.occurredAt))}</td>
        <td><span class="badge">${esc(ACTION_LABELS[e.action] ?? e.action)}</span></td>
        <td><div class="person"><span class="py-avatar py-avatar--sm">${esc(initials(e.actorName))}</span><div><strong>${esc(e.actorName)}</strong>${e.actorType === 'ADMIN' ? '<small>Platform support</small>' : ''}</div></div></td>
        <td>${e.targetName ? esc(e.targetName) : '<span class="muted">—</span>'}</td>
        <td>${esc(e.detail ?? '')}</td></tr>`).join('') : '';
      const body = !d ? '<tr><td colspan="5" class="empty">Loading audit log…</td></tr>' : rows || '<tr><td colspan="5" class="empty">No events match.</td></tr>';
      const from = d && d.totalItems ? d.page * d.size + 1 : 0, to = d ? Math.min((d.page + 1) * d.size, d.totalItems) : 0;
      return `<div class="users-page">
      ${s.error ? alertBox(s.error) : ''}
      <section class="panel">
        <div class="panel-head"><div><h2>Audit log</h2><p>Every change to portal settings and people in ${esc(ctx.portal.name)}. Entries can't be edited or deleted.</p></div></div>
        <div class="filters">
          <select class="py-select status" name="action" aria-label="Filter by action">${options([['', 'All actions'], ...Store.auditActions()], s.action)}</select>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>When</th><th>Action</th><th>Who</th><th>Affected</th><th>Details</th></tr></thead>
          <tbody>${body}</tbody></table></div>
        <div class="pager">
          <span class="py-caption">${d ? (d.totalItems ? `${from}–${to} of ${d.totalItems}` : '0 events') : ''}</span>
          <div class="pager-actions">
            <select class="py-select pager-size" name="size" aria-label="Rows per page">${options([['10', '10 per page'], ['25', '25 per page'], ['50', '50 per page']], String(s.size))}</select>
            <button class="py-btn py-btn--secondary" type="button" id="prev" ${!d || d.page === 0 ? 'disabled' : ''}>Previous</button>
            <button class="py-btn py-btn--secondary" type="button" id="next" ${!d || d.page + 1 >= d.totalPages ? 'disabled' : ''}>Next</button>
          </div>
        </div>
      </section></div>`;
    };
    let api;
    const load = async () => {
      try { s.data = await Store.auditEvents(ctx.portal.id, { action: s.action, page: s.page, size: s.size }); s.error = null; }
      catch (err) { s.error = err.message; s.data = s.data || { items: [], page: 0, size: s.size, totalItems: 0, totalPages: 1 }; }
      api.paint();
    };
    api = component(el, s, render, (el) => {
      el.querySelector('[name=action]').addEventListener('change', (e) => { s.action = e.target.value; s.page = 0; s.data = null; api.paint(); load(); });
      el.querySelector('[name=size]').addEventListener('change', (e) => { s.size = +e.target.value; s.page = 0; s.data = null; api.paint(); load(); });
      el.querySelector('#prev').addEventListener('click', () => { s.page -= 1; load(); });
      el.querySelector('#next').addEventListener('click', () => { s.page += 1; load(); });
    });
    load();
  }

  return {
    audit: (el, ctx) => page(el, ctx, 'audit', auditTab),
    portal: (el, ctx) => page(el, ctx, 'portal', portalTab),
    users: (el, ctx) => page(el, ctx, 'users', usersTab),
    preferences: (el, ctx) => page(el, ctx, 'preferences', preferencesTab),
  };
})();
