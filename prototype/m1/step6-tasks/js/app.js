/*
 * Route table and guards. Mirrors frontend/src/app/app.routes.ts and core/auth/auth.guards.ts.
 * Hash routes: open index.html and use #/sign-in, #/p/northwind-labs, ...
 */
(() => {
  const { Router, qs } = PY;
  const root = document.getElementById('app');
  const TITLE_SUFFIX = ' · ProjectY';
  const setTitle = (t) => { document.title = t + TITLE_SUFFIX; };

  /* ----- guards ----- */
  const guest = () => (Store.isSignedIn() ? (Router.navigate(Auth.landingUrl(), { replace: true }), false) : true);
  const authed = (ctx) => {
    if (Store.isSignedIn()) return true;
    Router.navigate('/sign-in' + qs({ returnUrl: ctx.path + qs(ctx.query) }), { replace: true });
    return false;
  };

  /** A signed-out screen: layout + the screen. `showcase: 'preview'` swaps the right pane to the portal preview. */
  function authRoute(path, title, view, { showcase = 'fork', guard } = {}) {
    Router.add(path, (ctx) => {
      if (guard && !guard(ctx)) return;
      setTitle(title);
      view(ctx, Auth.layout(root, showcase));
    });
  }

  authRoute('/sign-in', 'Sign in', Auth.signIn, { guard: guest });
  authRoute('/sign-up', 'Create account', Auth.signUp, { showcase: 'preview', guard: guest });
  authRoute('/check-email', 'Check your email', Auth.checkEmail, { showcase: 'preview' });
  authRoute('/verify-email', 'Confirm email', Auth.verifyEmail);
  authRoute('/forgot-password', 'Reset password', Auth.forgotPassword, { guard: guest });
  authRoute('/reset-password', 'Choose a new password', Auth.resetPassword);
  authRoute('/support-session-ended', 'Support session ended', Auth.supportEnded);
  authRoute('/portals/new', 'Set up your portal', Auth.createPortal, { showcase: 'preview', guard: authed });
  authRoute('/portals', 'Choose a portal', Auth.portalPicker, { guard: authed });
  authRoute('/invite', 'Join a portal', Auth.acceptInvite);
  authRoute('/portal-not-found', 'Portal not found', Auth.portalNotFound, { guard: authed });
  Router.add('/', () => Router.navigate(Store.isSignedIn() ? Auth.landingUrl() : '/sign-in', { replace: true }));

  /* ----- portal routes: /p/:slug/... inside the shell ----- */
  /**
   * @param nav      which sidebar item is active
   * @param crumb    breadcrumb text
   * @param permission optional permission the route needs (permissionGuard); otherwise back to portal home
   */
  function portalRoute(path, title, { nav, crumb, mount, permission, fluid = false }) {
    Router.add(path, (ctx) => {
      if (!authed(ctx)) return;
      const opened = Store.openPortal(ctx.params.slug);
      if (opened.result !== 'ok') return Router.navigate('/portal-not-found' + (opened.result === 'removed' ? '?reason=removed' : ''), { replace: true });
      const me = Store.currentUser();
      const pctx = {
        me, slug: ctx.params.slug, params: ctx.params, query: ctx.query, portal: opened.portal, membership: opened.membership,
        can: (permission) => opened.membership.permissions.includes(permission),
        timeZone: me.timeZone ?? opened.portal.timeZone ?? 'UTC', // the user's own zone wins (PTL-BR-05)
      };
      if (permission && !pctx.can(permission)) return Router.navigate(`/p/${ctx.params.slug}`, { replace: true });
      setTitle(title);
      Shell.render(root, pctx, { nav, crumb, mount, fluid });
    });
  }

  portalRoute('/p/:slug', 'Home', { nav: 'home', crumb: 'Home', mount: Home.mount });
  portalRoute('/p/:slug/projects', 'Projects', { nav: 'projects', crumb: 'Projects', mount: Projects.list, fluid: true, permission: 'PROJECTS_VIEW' });
  portalRoute('/p/:slug/projects/new', 'New project', { nav: 'projects', crumb: 'Projects / New', mount: Projects.create, permission: 'PROJECTS_CREATE' });
  portalRoute('/p/:slug/projects/trash', 'Project trash', { nav: 'projects', crumb: 'Projects / Trash', mount: Projects.trash, fluid: true, permission: 'PROJECTS_VIEW' });
  portalRoute('/p/:slug/projects/:id/edit', 'Edit project', { nav: 'projects', crumb: 'Projects / Edit', mount: Projects.edit, permission: 'PROJECTS_VIEW' });
  portalRoute('/p/:slug/projects/:id/settings', 'Project settings', { nav: 'projects', crumb: 'Projects / Settings', mount: Projects.settings, permission: 'PROJECTS_VIEW' });
  portalRoute('/p/:slug/projects/:id/tasks/:tid', 'Task', { nav: 'projects', crumb: 'Projects / Tasks', mount: Tasks.detail, fluid: true, permission: 'TASKS_VIEW' });
  portalRoute('/p/:slug/projects/:id/tasks', 'Tasks', { nav: 'projects', crumb: 'Projects / Tasks', mount: Tasks.tab, fluid: true, permission: 'TASKS_VIEW' });
  portalRoute('/p/:slug/tasks', 'Tasks', { nav: 'tasks', crumb: 'Tasks', mount: AllTasks.mount, fluid: true, permission: 'TASKS_VIEW' });
  portalRoute('/p/:slug/projects/:id', 'Project', { nav: 'projects', crumb: 'Projects', mount: Projects.overview, fluid: true, permission: 'PROJECTS_VIEW' });
  /* ----- settings: its own full-page shell (Linear style), module-wise: /p/:slug/settings/<portal page> or /settings/<module>/<page> ----- */
  function settingsRoute(path, title, { nav, heading, mount, permission, wide = false, full = false, entity = 'PROJECT' }) {
    Router.add(path, (ctx) => {
      if (!authed(ctx)) return;
      const opened = Store.openPortal(ctx.params.slug);
      if (opened.result !== 'ok') return Router.navigate('/portal-not-found' + (opened.result === 'removed' ? '?reason=removed' : ''), { replace: true });
      const me = Store.currentUser();
      const pctx = { me, slug: ctx.params.slug, params: ctx.params, query: ctx.query, portal: opened.portal, membership: opened.membership, entity,
        can: (permission) => opened.membership.permissions.includes(permission), timeZone: me.timeZone ?? opened.portal.timeZone ?? 'UTC' };
      if (permission && !pctx.can(permission)) return Router.navigate(`/p/${ctx.params.slug}/settings`, { replace: true });
      LSettings.render(root, pctx, { nav, title, heading, mount, wide, full });
    });
  }
  const S = '/p/:slug/settings';
  Router.add(S, (ctx) => Router.navigate(`/p/${ctx.params.slug}/settings/portal`, { replace: true }));
  settingsRoute(`${S}/portal`, 'Portal profile', { nav: 'portal', heading: ['Portal profile', 'How your portal looks and behaves for everyone in it.'], mount: Settings.portalTab });
  settingsRoute(`${S}/users`, 'Users & profiles', { nav: 'users', heading: ['Users & profiles', 'Who is in the portal, and what each profile may do.'], mount: Settings.usersTab, permission: 'USERS_VIEW', wide: true });
  settingsRoute(`${S}/audit`, 'Audit log', { nav: 'audit', heading: ['Audit log', 'Every change to portal settings and people, newest first. Entries cannot be edited or deleted.'], mount: Settings.auditTab, permission: 'AUDIT_VIEW', wide: true });
  settingsRoute(`${S}/preferences`, 'My preferences', { nav: 'preferences', heading: ['My preferences', 'Only for you. Nobody else in the portal sees these.'], mount: Settings.preferencesTab });
  settingsRoute(`${S}/projects/fields`, 'Fields · Projects', { nav: 'projects/fields', heading: ['Fields', 'Extra details every project can carry. Layouts decide where they appear.'], mount: CustomFields.tab, permission: 'CUSTOM_FIELDS_VIEW', wide: true });
  settingsRoute(`${S}/projects/fields/new`, 'New field · Projects', { nav: 'projects/fields', mount: CustomFields.create, permission: 'CUSTOM_FIELDS_MANAGE', wide: true });
  settingsRoute(`${S}/projects/fields/:id/edit`, 'Edit field · Projects', { nav: 'projects/fields', mount: CustomFields.edit, permission: 'CUSTOM_FIELDS_MANAGE', wide: true });
  settingsRoute(`${S}/projects/layouts`, 'Layouts · Projects', { nav: 'projects/layouts', mount: Layouts.list, permission: 'CUSTOM_FIELDS_VIEW' });
  settingsRoute(`${S}/projects/layouts/:id`, 'Edit layout · Projects', { nav: 'projects/layouts', mount: Layouts.edit, permission: 'CUSTOM_FIELDS_MANAGE', full: true });
  settingsRoute(`${S}/projects/statuses`, 'Statuses · Projects', { nav: 'projects/statuses', heading: ['Statuses', 'The stages a project moves through, grouped by what they mean.'], mount: (el) => LSettings.statuses(el), permission: 'PROJECTS_VIEW' });
  settingsRoute(`${S}/projects/templates`, 'Templates · Projects', { nav: 'projects/templates', heading: ['Templates', 'Starting points for new projects.'], mount: (el) => LSettings.templates(el), permission: 'PROJECTS_VIEW' });
  settingsRoute(`${S}/tasks/fields`, 'Fields · Tasks', { nav: 'tasks/fields', heading: ['Fields', 'Extra details every task can carry. Layouts decide where they appear.'], mount: CustomFields.tab, permission: 'CUSTOM_FIELDS_VIEW', wide: true, entity: 'TASK' });
  settingsRoute(`${S}/tasks/fields/new`, 'New field · Tasks', { nav: 'tasks/fields', mount: CustomFields.create, permission: 'CUSTOM_FIELDS_MANAGE', wide: true, entity: 'TASK' });
  settingsRoute(`${S}/tasks/fields/:id/edit`, 'Edit field · Tasks', { nav: 'tasks/fields', mount: CustomFields.edit, permission: 'CUSTOM_FIELDS_MANAGE', wide: true, entity: 'TASK' });
  settingsRoute(`${S}/tasks/layouts`, 'Layouts · Tasks', { nav: 'tasks/layouts', mount: Layouts.list, permission: 'CUSTOM_FIELDS_VIEW', entity: 'TASK' });
  settingsRoute(`${S}/tasks/layouts/:id`, 'Edit layout · Tasks', { nav: 'tasks/layouts', mount: Layouts.edit, permission: 'CUSTOM_FIELDS_MANAGE', full: true, entity: 'TASK' });
  settingsRoute(`${S}/tasks/statuses`, 'Statuses · Tasks', { nav: 'tasks/statuses', heading: ['Statuses', 'The stages a task moves through. Every task layout has its own set.'], mount: TaskSettings.statuses, permission: 'CUSTOM_FIELDS_VIEW', entity: 'TASK' });
  Router.add(`${S}/tasks`, (ctx) => Router.navigate(`/p/${ctx.params.slug}/settings/tasks/fields`, { replace: true }));
  for (const m of LSettings.SOON) settingsRoute(`${S}/${m.id}`, `${m.name} · Soon`, { nav: m.id, heading: [m.name, ''], mount: (el) => LSettings.soon(el, m) });
  // the older Step 7 addresses keep working
  Router.add(`${S}/custom-fields`, (ctx) => Router.navigate(`/p/${ctx.params.slug}/settings/projects/fields`, { replace: true }));
  Router.add(`${S}/custom-fields/layouts`, (ctx) => Router.navigate(`/p/${ctx.params.slug}/settings/projects/layouts`, { replace: true }));

  Router.start();
})();
