/*
 * Signed-in layout for /p/{slug} (frontend/src/app/features/shell/portal-shell.*): sidebar with the portal
 * switcher, top bar, and the current page in .content.
 */
const Shell = (() => {
  const { esc, icon, initials, Router } = PY;

  /** Sections that arrive with the Work service (M1); shown so the layout is complete, but disabled. */
  const COMING_LATER_BEFORE = [['user', 'My Work'], ['inbox', 'Inbox']];
  const COMING_LATER_AFTER = [['layers', 'Portfolio'], ['chart', 'Reports']];
  const soon = ([ic, label]) => `<button type="button" disabled title="Coming in a later step">${icon(ic)}<span class="nav-label">${label}</span></button>`;

  /**
   * @param ctx    { me, portal, membership, can(permission), timeZone, slug }
   * @param page   { crumb, nav: 'home' | 'settings', mount(contentEl, ctx) }
   */
  function render(root, ctx, page) {
    const { me, portal, membership } = ctx;
    const base = `#/p/${portal.slug}`;
    root.innerHTML = `<div class="shell"><div class="app">
      <aside class="sidebar">
        <a class="brand" href="${base}" aria-label="ProjectY home">
          <span class="mark"><svg viewBox="0 0 32 32"><path d="M7 7 16 17 25 7M16 17V27" /><circle cx="16" cy="17" r="4" /></svg></span>
          <span class="brand-name">ProjectY</span>
        </a>

        <div class="portal-wrap">
          <button class="portal" type="button" aria-haspopup="menu" aria-expanded="false" id="switcher-btn">
            <span class="py-tile">${esc(initials(portal.name))}</span>
            <span class="portal-copy"><strong>${esc(portal.name)}</strong><small>${membership.owner ? 'Owner · ' : ''}${esc(membership.profileName)}</small></span>
            ${icon('chevrons')}
          </button>
          <div class="py-menu py-menu--down" role="menu" id="switcher-menu" hidden>
            <div class="py-menu-label">Your portals</div>
            ${me.portals.map((p) => `<button type="button" role="menuitem" class="py-menu-item${p.id === portal.id ? ' current' : ''}" data-switch="${esc(p.slug)}">
              <span class="py-tile py-tile--sm">${esc(initials(p.name))}</span>
              <span class="menu-copy"><strong>${esc(p.name)}</strong><small>${esc(p.slug)}.projecty.app</small></span>
              ${p.id === portal.id ? icon('check') : ''}</button>`).join('')}
            <div class="py-menu-sep"></div>
            <a class="py-menu-item" role="menuitem" href="#/portals/new">${icon('plus')}Create a portal</a>
          </div>
        </div>

        <div class="nav-group">
          <div class="section-label">Workspace</div>
          <nav class="nav" aria-label="Main navigation">
            <a href="${base}" class="${page.nav === 'home' ? 'active' : ''}">${icon('home')}<span class="nav-label">Home</span></a>
            ${COMING_LATER_BEFORE.map(soon).join('')}
            <a href="${base}/projects" class="${page.nav === 'projects' ? 'active' : ''}">${icon('folder')}<span class="nav-label">Projects</span></a>
            ${COMING_LATER_AFTER.map(soon).join('')}
          </nav>
        </div>
        <div class="nav-group">
          <div class="section-label">Personal</div>
          <nav class="nav"><button type="button" disabled title="Coming with Documents (M1)">${icon('file')}<span class="nav-label">Documents</span></button></nav>
        </div>

        <div class="side-bottom">
          <nav class="nav"><a href="${base}/settings" class="${page.nav === 'settings' ? 'active' : ''}">${icon('settings')}<span class="nav-label">Settings</span></a></nav>
          <div class="user">
            <span class="py-avatar">${esc(initials(me.fullName))}</span>
            <span class="user-copy"><strong>${esc(me.fullName)}</strong><small>${esc(me.email)}</small></span>
            <button class="icon-btn" type="button" aria-label="User menu" aria-haspopup="menu" aria-expanded="false" id="user-btn">${icon('chevrons')}</button>
            <div class="py-menu py-menu--up" role="menu" id="user-menu" hidden>
              <a class="py-menu-item" role="menuitem" href="${base}/settings/preferences">${icon('globe')}My preferences</a>
              <button class="py-menu-item" type="button" role="menuitem" id="sign-out">${icon('log-out')}Sign out</button>
            </div>
          </div>
        </div>
      </aside>

      <main class="main">
        <header class="topbar">
          <button class="icon-btn mobile-menu" type="button" aria-label="Toggle sidebar" id="sidebar-btn">${icon('layers')}</button>
          <div class="crumb">${esc(portal.name)} <span class="sep">/</span> <b>${esc(page.crumb)}</b></div>
          <label class="search" title="Search arrives with Projects (M1)">
            ${icon('search')}<input placeholder="Search tasks, projects..." aria-label="Search" disabled /><span class="kbd">⌘ K</span>
          </label>
          <button class="icon-btn" type="button" aria-label="Notifications" title="Notifications arrive in M1" disabled>${icon('bell')}</button>
          ${PY.themeButton('icon-btn')}
          <span class="py-avatar py-avatar--sm" title="${esc(me.email)}">${esc(initials(me.fullName))}</span>
        </header>
        <div class="content" id="content"></div>
      </main>
    </div></div>`;

    PY.wireThemeToggle(root);
    wireMenus(root);
    root.querySelectorAll('[data-switch]').forEach((b) => b.addEventListener('click', () => Router.navigate(`/p/${b.dataset.switch}`)));
    root.querySelector('#sign-out').addEventListener('click', () => { Store.signOut(); Router.navigate('/sign-in'); });
    root.querySelector('#sidebar-btn').addEventListener('click', () => root.querySelector('.app').classList.toggle('sidebar-open'));
    page.mount(root.querySelector('#content'), ctx);
  }

  /** Portal switcher and user menu: one open at a time, closed by an outside click or Escape. */
  let docHandlersBound = false;
  function wireMenus(root) {
    const pairs = [['#switcher-btn', '#switcher-menu'], ['#user-btn', '#user-menu']];
    const closeAll = () => pairs.forEach(([b, m]) => { const menu = root.querySelector(m), btn = root.querySelector(b); if (menu) { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
    pairs.forEach(([b, m]) => root.querySelector(b).addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = root.querySelector(m), wasOpen = !menu.hidden;
      closeAll();
      menu.hidden = wasOpen; e.currentTarget.setAttribute('aria-expanded', String(!wasOpen));
    }));
    root.querySelectorAll('.py-menu').forEach((m) => m.addEventListener('click', (e) => e.stopPropagation()));
    if (!docHandlersBound) {
      docHandlersBound = true;
      document.addEventListener('click', () => document.querySelectorAll('.py-menu').forEach((m) => { m.hidden = true; }));
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.py-menu').forEach((m) => { m.hidden = true; }); });
    }
  }

  return { render };
})();
