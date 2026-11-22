/*
 * Portal home (frontend/src/app/features/home/home.html). Tasks, projects, agenda and activity come with the
 * Work service in M1, so these panels show what will appear there.
 */
const Home = (() => {
  const { esc, icon, formatDate, hourIn } = PY;
  const STATS = [['check', 'My open tasks'], ['chart', 'Due this week'], ['folder', 'Projects in progress'], ['layers', 'Completed this month']];
  const WEEK_START_LABELS = { MONDAY: 'Monday', SUNDAY: 'Sunday', SATURDAY: 'Saturday' };

  function mount(el, ctx) {
    const { me, portal, timeZone } = ctx;
    const now = new Date();
    const hour = hourIn(now, timeZone);
    const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const first = me.fullName.split(/\s+/)[0];
    const fmt = (pattern) => formatDate(now, pattern || portal.dateFormat, timeZone);

    el.innerHTML = `<div class="home">
      <section class="page-head">
        <div>
          <div class="eyebrow">${fmt('EEEE')} · ${fmt()}</div>
          <h1>${esc(first ? `${part}, ${first}` : part)}</h1>
          <p>Here’s what’s happening in ${esc(portal.name)} today.</p>
        </div>
      </section>

      <section class="stats" aria-label="Workspace summary">
        ${STATS.map(([ic, label]) => `<div class="stat">
          <div class="stat-label"><span class="stat-icon">${icon(ic)}</span>${label}</div>
          <div class="stat-value">—</div>
          <div class="stat-foot">Arrives with Projects</div></div>`).join('')}
      </section>

      <div class="grid">
        <div class="stack">
          <section class="panel">
            <div class="panel-head"><div><h2>My tasks</h2><p>Your next steps, all in one place</p></div></div>
            <div class="empty">No tasks yet. Tasks arrive with Projects in the next milestone.</div>
          </section>
          <section class="panel">
            <div class="panel-head"><div><h2>Projects</h2><p>Progress across your active projects</p></div></div>
            <div class="empty">No projects yet.</div>
          </section>
        </div>

        <div class="stack">
          <section class="panel">
            <div class="panel-head"><div><h2>Today’s agenda</h2><p>${fmt('EEEE, MMMM d')}</p></div></div>
            <div class="empty">Nothing scheduled.</div>
          </section>
          <section class="panel">
            <div class="panel-head">
              <div><h2>Portal settings</h2><p>How dates and money show for everyone</p></div>
              ${ctx.can('PORTAL_SETTINGS_MANAGE') ? `<a class="text-btn" href="#/p/${esc(portal.slug)}/settings">Edit →</a>` : ''}
            </div>
            <dl class="facts">
              <div><dt>Time zone</dt><dd>${esc(portal.timeZone)}</dd></div>
              <div><dt>Your time zone</dt><dd>${esc(me.timeZone ?? 'Portal default')}</dd></div>
              <div><dt>Date format</dt><dd>${fmt()}</dd></div>
              <div><dt>Currency</dt><dd>${esc(portal.currency)}</dd></div>
              <div><dt>Week starts</dt><dd>${esc(WEEK_START_LABELS[portal.weekStart] ?? portal.weekStart)}</dd></div>
            </dl>
          </section>
        </div>
      </div>
    </div>`;
  }

  return { mount };
})();
