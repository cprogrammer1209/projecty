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
  function portalRoute(path, title, { nav, crumb, mount, permission }) {
    Router.add(path, (ctx) => {
      if (!authed(ctx)) return;
      const opened = Store.openPortal(ctx.params.slug);
      if (opened.result !== 'ok') return Router.navigate('/portal-not-found' + (opened.result === 'removed' ? '?reason=removed' : ''), { replace: true });
      const me = Store.currentUser();
      const pctx = {
        me, slug: ctx.params.slug, portal: opened.portal, membership: opened.membership,
        can: (permission) => opened.membership.permissions.includes(permission),
        timeZone: me.timeZone ?? opened.portal.timeZone ?? 'UTC', // the user's own zone wins (PTL-BR-05)
      };
      if (permission && !pctx.can(permission)) return Router.navigate(`/p/${ctx.params.slug}`, { replace: true });
      setTitle(title);
      Shell.render(root, pctx, { nav, crumb, mount });
    });
  }

  portalRoute('/p/:slug', 'Home', { nav: 'home', crumb: 'Home', mount: Home.mount });
  portalRoute('/p/:slug/settings', 'Settings', { nav: 'settings', crumb: 'Settings', mount: Settings.portal });
  portalRoute('/p/:slug/settings/portal', 'Settings', { nav: 'settings', crumb: 'Settings', mount: Settings.portal });
  portalRoute('/p/:slug/settings/users', 'Settings', { nav: 'settings', crumb: 'Users', mount: Settings.users, permission: 'USERS_VIEW' });
  portalRoute('/p/:slug/settings/audit', 'Settings', { nav: 'settings', crumb: 'Audit log', mount: Settings.audit, permission: 'AUDIT_VIEW' });
  portalRoute('/p/:slug/settings/preferences', 'Settings', { nav: 'settings', crumb: 'My preferences', mount: Settings.preferences });

  Router.start();
})();
