/*
 * Signed-out screens (frontend/src/app/features/auth/**): two-pane layout, both showcases, and every screen.
 * Markup, class names and copy are taken from the Angular templates.
 */
const Auth = (() => {
  const { esc, icon, spinner, field, input, passwordInput, alertBox, initials, slugify, component, Router, qs } = PY;
  const { PASSWORD_MIN_LENGTH: MIN_LEN, EMAIL_PATTERN } = PY;
  const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, SLUG_MIN = 3, SLUG_MAX = 30, SLUG_CHECK_DELAY_MS = 350;
  const RESEND_COOLDOWN_S = 30;

  /** SignupDraftStore: what was typed so far; drives the live portal preview. */
  const draft = { fullName: '', email: '', portalName: '', slug: '' };

  /** Where a signed-in user lands: no portal -> create one, one -> open it, several -> picker. */
  function landingUrl() {
    const me = Store.currentUser();
    if (!me) return '/sign-in';
    if (me.portals.length === 0) return '/portals/new';
    return me.portals.length === 1 ? `/p/${me.portals[0].slug}` : '/portals';
  }

  /* ---------- layout + showcases ---------- */
  const flowShowcase = () => `<div class="flow-showcase">
    <div class="copy">
      <h2 class="py-display">Every task has a reason.<br />Every move has a rule.</h2>
      <p class="py-body">Blueprints decide which status can follow which, and what has to be true before work moves on.</p>
    </div>
    <div class="fork">
      <svg class="fork__lines" viewBox="0 0 520 170" preserveAspectRatio="xMinYMid meet">
        <path class="fork__line" d="M80 85 H230" />
        <path class="fork__line" d="M240 85 C290 85 300 30 360 30 H400" />
        <path class="fork__line" d="M240 85 C290 85 300 140 360 140 H400" />
        <path class="fork__line fork__line--taken" d="M80 85 H230 M240 85 C290 85 300 140 360 140 H400" />
        <circle class="fork__node" cx="240" cy="85" r="9" />
      </svg>
      <span class="pill pill--review" style="left: 15.4%; top: 50%">${icon('s-review')}In review</span>
      <span class="pill pill--progress" style="left: 80%; top: 17.6%">${icon('s-progress')}In progress</span>
      <span class="pill pill--review" style="left: 80%; top: 82.4%">${icon('s-review')}QA</span>
    </div>
    <div class="card">
      <div class="card__head">
        <div class="py-heading">Send to QA</div>
        <div class="card__sub py-caption"><span class="py-id">WEB-1043</span><span>Set up CMS content models</span></div>
      </div>
      <div class="card__body">
        <div class="ci ci--done"><span class="ci__box">${icon('check')}</span>Unit tests passed</div>
        <div class="ci ci--done"><span class="ci__box">${icon('check')}</span>Code reviewed</div>
        <div class="ci"><span class="ci__box"></span>Docs updated <span class="ci__opt">Optional</span></div>
      </div>
      <div class="card__foot"><span class="py-caption">2 of 2 required items done</span><span class="py-btn py-btn--primary">Send to QA</span></div>
    </div>
  </div>`;

  const PREVIEW_NAV = [['home', 'Home'], ['user', 'My work'], ['inbox', 'Inbox'], ['folder', 'Projects'], ['chart', 'Reports'], ['settings', 'Settings']];
  const portalPreview = () => `<div class="portal-preview">
    <div class="copy">
      <h2 class="py-display">Your portal, set up in a minute.</h2>
      <p class="py-body">This is what your team sees when they sign in. It fills in as you type.</p>
    </div>
    <div class="preview">
      <div class="preview__top">
        <div class="preview__portal"><span class="preview__tile" data-pv="tile"></span><span class="preview__pname" data-pv="name"></span></div>
        <div class="preview__search"><span>Search</span><span class="preview__kbd">⌘K</span></div>
        <span class="preview__avatar" data-pv="avatar"></span>
      </div>
      <div class="preview__body">
        <nav class="preview__side">${PREVIEW_NAV.map(([ic, label], i) => `<span class="preview__nav${i === 0 ? ' preview__nav--active' : ''}">${icon(ic)}${label}</span>`).join('')}</nav>
        <div class="preview__main">
          <div><div class="preview__greet" data-pv="greeting"></div><div class="preview__url" data-pv="url"></div></div>
          <div>${[62, 48, 70, 40].map((w) => `<div class="preview__row"><span class="box"></span><div class="skel" style="width:${w}%"></div></div>`).join('')}</div>
        </div>
      </div>
    </div>
  </div>`;

  /** Fills the preview from the draft; cheap enough to call on every keystroke. */
  function paintPreview() {
    const root = document.querySelector('.portal-preview');
    if (!root) return;
    const first = draft.fullName.trim().split(/\s+/)[0];
    const set = (key, text) => { const n = root.querySelector(`[data-pv="${key}"]`); if (n) n.textContent = text; };
    set('name', draft.portalName.trim() || 'Your portal');
    set('tile', initials(draft.portalName) || 'P');
    set('avatar', initials(draft.fullName) || '?');
    set('greeting', first ? `Welcome, ${first}` : 'Welcome to ProjectY');
    set('url', `${draft.slug || 'your-portal'}.projecty.app`);
  }

  /** Builds the page chrome and returns the element a screen renders into. */
  function layout(root, showcase = 'fork') {
    root.innerHTML = `<div class="auth-scope"><div class="auth">
      <div class="auth__pane">
        <header class="auth__header">${PY.logo}${PY.themeButton()}</header>
        <main class="auth__main"><div class="auth__form-wrap" id="view"></div></main>
        <footer class="auth__footer py-caption"><span>© ${new Date().getFullYear()} ProjectY</span>
          <button class="py-link-btn" type="button" data-reset-demo title="Prototype only: restores the demo accounts">Reset demo data</button></footer>
      </div>
      <aside class="auth__showcase" aria-hidden="true">${showcase === 'preview' ? portalPreview() : flowShowcase()}</aside>
    </div></div>`;
    PY.wireThemeToggle(root);
    root.querySelector('[data-reset-demo]').addEventListener('click', () => { Store.reset(); Router.navigate('/sign-in'); });
    paintPreview();
    return root.querySelector('#view');
  }

  /* ---------- small helpers ---------- */
  /** Copy typed values into state without re-rendering (keeps focus). */
  function sync(el, state, onChange) {
    el.querySelectorAll('input[name], select[name]').forEach((i) => {
      i.addEventListener('input', () => { state[i.name] = i.type === 'checkbox' ? i.checked : i.value; if (onChange) onChange(i.name, i); });
    });
  }
  const stepper = (step, label) => `<div class="py-stepper"><span class="py-caption py-stepper__label">Step ${step} of 2 · ${label}</span>
    <div class="py-stepper__track" role="progressbar" aria-label="Sign-up progress" aria-valuemin="1" aria-valuemax="2" aria-valuenow="${step}"><div class="py-stepper__fill" style="width:${step * 50}%"></div></div></div>`;
  const submitLabel = (busy, busyText, text) => (busy ? `${spinner}${busyText}` : text);
  const emailErr = (v, submitted) => (!submitted ? null : !v.trim() ? 'Enter your email.' : !EMAIL_PATTERN.test(v.trim()) ? 'Enter an email like name@company.com.' : null);
  const badge = (name) => `<div class="py-badge-icon">${icon(name)}</div>`;
  const head = (id, title, body = '') => `<div class="py-view-head"><h1 class="py-title" id="${id}">${title}</h1>${body ? `<p class="py-body">${body}</p>` : ''}</div>`;
  const link = (path, text, cls = '') => `<a ${cls ? `class="${cls}"` : ''} href="#${path}">${text}</a>`;
  const devNote = (text, buttonId, buttonLabel) => `<div class="dev-note"><b>Prototype only.</b> ${text}<br><button class="py-btn py-btn--secondary" type="button" id="${buttonId}">${buttonLabel}</button></div>`;

  /* ---------- sign in ---------- */
  function signIn(ctx, el) {
    const returnUrl = ctx.query.returnUrl;
    const s = { email: ctx.query.email || '', password: '', submitted: false, busy: false, alert: null };
    const render = (s) => {
      const eErr = emailErr(s.email, s.submitted), pErr = s.submitted && !s.password ? 'Enter your password.' : null;
      let alert = '';
      if (s.alert) {
        const a = s.alert;
        alert = a.kind === 'credentials'
          ? alertBox(`That email and password don't match. Check for typos, or ${link('/forgot-password', 'reset your password')}.`, 'error', true)
          : a.kind === 'unverified' && a.resent ? alertBox('We sent a new confirmation link. Open it, then sign in.', 'ok')
          : a.kind === 'unverified' ? alertBox('Confirm your email first. Check your inbox, or <button class="py-link-btn" type="button" id="resend">send a new link</button>.', 'error', true)
          : alertBox(a.text);
      }
      return `<section aria-labelledby="signin-title">
        ${head('signin-title', 'Sign in to ProjectY', 'Use your work email and password.')}${alert}
        <form class="py-form" novalidate>
          ${field({ label: 'Work email', id: 'si-email', error: eErr, body: input({ id: 'si-email', name: 'email', type: 'email', value: s.email, autocomplete: 'username', placeholder: 'name@company.com', error: eErr }) })}
          ${field({ label: 'Password', id: 'si-password', error: pErr, action: `<a class="py-label" href="#/forgot-password">Forgot password?</a>`,
            body: passwordInput({ id: 'si-password', name: 'password', value: s.password, autocomplete: 'current-password', error: pErr }) })}
          <button class="py-btn py-btn--primary py-btn--block" type="submit" ${s.busy ? 'disabled' : ''}>${submitLabel(s.busy, 'Signing in', 'Sign in')}</button>
        </form>
        <p class="py-switch">New to ProjectY? ${link('/sign-up', 'Create an account')}</p>
        <div class="dev-note"><b>Prototype only.</b> Demo logins (password <code>password123</code>): <code>priya@northwind.com</code> (Admin, two portals) or <code>ravi@northwind.com</code> (Employee).</div>
      </section>`;
    };
    const c = component(el, s, render, (el, api) => {
      sync(el, s);
      el.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        s.submitted = true; s.alert = null;
        if (emailErr(s.email, true) || !s.password) { api.paint(); return PY.focusFirstInvalid(el); }
        api.set({ busy: true });
        try {
          await Store.signIn({ email: s.email, password: s.password });
          Router.navigate(returnUrl || landingUrl());
        } catch (err) {
          api.set({ busy: false, alert: err.code === 'INVALID_CREDENTIALS' ? { kind: 'credentials' } : err.code === 'EMAIL_NOT_VERIFIED' ? { kind: 'unverified' } : { kind: 'message', text: err.message } });
        }
      });
      el.querySelector('#resend')?.addEventListener('click', async () => { await Store.resendVerification(s.email); api.set({ alert: { kind: 'unverified', resent: true } }); });
    });
    return c;
  }

  /* ---------- sign up ---------- */
  function signUp(ctx, el) {
    const s = { fullName: draft.fullName, email: draft.email, password: '', submitted: false, busy: false, alert: null, taken: false };
    const lengthMet = () => s.password.length >= MIN_LEN;
    const render = (s) => {
      const nErr = s.submitted && !s.fullName.trim() ? 'Enter your full name.' : null;
      const eErr = s.taken ? 'An account with this email already exists.' : emailErr(s.email, s.submitted);
      const pErr = s.submitted && !s.password ? 'Choose a password.' : s.submitted && !lengthMet() ? `Use at least ${MIN_LEN} characters.` : null;
      return `${stepper(1, 'Your account')}
      <section aria-labelledby="signup-title">
        ${head('signup-title', 'Create your ProjectY account', "Next, you'll confirm your email and set up your portal.")}
        ${s.alert ? alertBox(s.alert) : ''}
        <form class="py-form" novalidate>
          ${field({ label: 'Full name', id: 'su-name', error: nErr, body: input({ id: 'su-name', name: 'fullName', value: s.fullName, autocomplete: 'name', error: nErr }) })}
          ${field({ label: 'Work email', id: 'su-email', error: eErr, body: input({ id: 'su-email', name: 'email', type: 'email', value: s.email, autocomplete: 'email', placeholder: 'name@company.com', error: eErr })
            + (s.taken ? `<p class="py-field__hint">${link('/sign-in', 'Sign in instead')} or ${link('/forgot-password', 'reset your password')}.</p>` : '') })}
          ${field({ label: 'Password', id: 'su-password', error: pErr, body: passwordInput({ id: 'su-password', name: 'password', value: s.password, autocomplete: 'new-password', error: pErr, describedBy: 'su-password-rules' })
            + `<div class="rules" id="su-password-rules" aria-live="polite"><span class="rule${lengthMet() ? ' is-met' : ''}" data-rule>${icon(lengthMet() ? 'check' : 'dot')}${MIN_LEN}+ characters</span></div>` })}
          <button class="py-btn py-btn--primary py-btn--block" type="submit" ${s.busy ? 'disabled' : ''}>${submitLabel(s.busy, 'Creating account', 'Continue')}</button>
        </form>
        <p class="py-switch">Already have an account? ${link('/sign-in', 'Sign in')}</p>
      </section>`;
    };
    return component(el, s, render, (el, api) => {
      sync(el, s, (name, node) => {
        if (name === 'fullName' || name === 'email') { draft[name] = s[name]; paintPreview(); }
        if (name === 'email' && s.taken) s.taken = false;
        if (name === 'password') { // live rule, no re-render so focus stays
          const rule = el.querySelector('[data-rule]');
          rule.classList.toggle('is-met', lengthMet()); rule.firstElementChild.setAttribute('name', lengthMet() ? 'check' : 'dot');
        }
      });
      el.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        s.submitted = true; s.alert = null;
        if (!s.fullName.trim() || emailErr(s.email, true) || !lengthMet()) { api.paint(); return PY.focusFirstInvalid(el); }
        api.set({ busy: true });
        try {
          await Store.signUp({ fullName: s.fullName, email: s.email, password: s.password });
          Router.navigate('/check-email');
        } catch (err) {
          if (err.code === 'EMAIL_TAKEN') { api.set({ busy: false, taken: true }); PY.focusFirstInvalid(el); }
          else api.set({ busy: false, alert: err.message });
        }
      });
    });
  }

  /* ---------- check email ---------- */
  function checkEmail(ctx, el) {
    const signup = Store.lastSignup();
    const s = { email: signup?.email || '', busy: false, error: null, cooldown: 0 };
    let timer = null;
    const render = (s) => `<section aria-labelledby="check-title">
      ${badge('mail')}
      ${head('check-title', 'Check your email', `We sent a confirmation link to <strong>${esc(s.email || 'your inbox')}</strong>. Open it, then sign in to set up your portal.`)}
      ${s.error ? alertBox(s.error) : ''}
      ${s.email ? `<button class="py-btn py-btn--secondary py-btn--block" type="button" id="resend" ${s.busy || s.cooldown > 0 ? 'disabled' : ''}>${s.cooldown > 0 ? `Link sent. Resend in ${s.cooldown}s` : 'Resend link'}</button>
        <p class="py-switch"><button class="py-link-btn" type="button" id="different">Use a different email</button></p>
        ${devNote('There is no mailbox here (the app uses Mailpit). This stands in for clicking the link in the email.', 'open-link', 'Open the confirmation link')}`
        : `<a class="py-btn py-btn--secondary py-btn--block" href="#/sign-in">Go to sign in</a>`}
    </section>`;
    const startCooldown = (api) => {
      s.cooldown = RESEND_COOLDOWN_S; clearInterval(timer);
      timer = setInterval(() => { if (!document.body.contains(el)) return clearInterval(timer); s.cooldown -= 1; if (s.cooldown <= 0) clearInterval(timer); api.paint(); }, 1000);
    };
    return component(el, s, render, (el, api) => {
      el.querySelector('#resend')?.addEventListener('click', async () => { api.set({ busy: true }); await Store.resendVerification(s.email); s.busy = false; startCooldown(api); api.paint(); });
      el.querySelector('#different')?.addEventListener('click', () => { Store.clearLastSignup(); Router.navigate('/sign-up'); });
      el.querySelector('#open-link')?.addEventListener('click', () => Router.navigate('/verify-email' + qs({ token: Store.pendingToken(s.email, 'VERIFY') || 'missing' })));
    });
  }

  /* ---------- verify email ---------- */
  function verifyEmail(ctx, el) {
    const s = { state: 'verifying', message: '' };
    const render = (s) => `<section aria-labelledby="verify-title" aria-live="polite">${{
      verifying: head('verify-title', 'Confirming your email…', 'This takes a second.'),
      verified: `${badge('check')}${head('verify-title', 'Email confirmed', 'Your account is ready. Sign in to set up your portal.')}<a class="py-btn py-btn--primary py-btn--block" href="#/sign-in">Sign in</a>`,
      expired: `${head('verify-title', 'This link has expired', "Confirmation links work once and last 24 hours. Sign in and we'll offer to send a new one.")}<a class="py-btn py-btn--primary py-btn--block" href="#/sign-in">Go to sign in</a>`,
      failed: `${head('verify-title', "We couldn't confirm your email")}${alertBox(s.message)}<a class="py-btn py-btn--secondary py-btn--block" href="#/sign-in">Go to sign in</a>`,
    }[s.state]}</section>`;
    const c = component(el, s, render);
    Store.verifyEmail(ctx.query.token).then(
      () => c.set({ state: 'verified' }),
      (err) => c.set(err.code === 'TOKEN_EXPIRED' ? { state: 'expired' } : { state: 'failed', message: err.message }),
    );
    return c;
  }

  /* ---------- forgot password ---------- */
  function forgotPassword(ctx, el) {
    const s = { email: '', submitted: false, busy: false, sentTo: null, alert: null };
    const render = (s) => {
      if (s.sentTo) return `<section aria-labelledby="forgot-title">${badge('mail')}
        ${head('forgot-title', 'Check your email', `If an account exists for <strong>${esc(s.sentTo)}</strong>, we sent a link to reset the password. It works for 1 hour.`)}
        <a class="py-btn py-btn--secondary py-btn--block" href="#/sign-in">${icon('arrow-left')}Back to sign in</a>
        ${devNote('This stands in for the email. It only works if the address has an account (try priya@northwind.com).', 'open-link', 'Open the reset link')}</section>`;
      const eErr = emailErr(s.email, s.submitted);
      return `<section aria-labelledby="forgot-title">
        ${head('forgot-title', 'Reset your password', "Enter your work email and we'll send you a link to choose a new password.")}
        ${s.alert ? alertBox(s.alert) : ''}
        <form class="py-form" novalidate>
          ${field({ label: 'Work email', id: 'fp-email', error: eErr, body: input({ id: 'fp-email', name: 'email', type: 'email', value: s.email, autocomplete: 'username', placeholder: 'name@company.com', error: eErr }) })}
          <button class="py-btn py-btn--primary py-btn--block" type="submit" ${s.busy ? 'disabled' : ''}>${submitLabel(s.busy, 'Sending link', 'Send reset link')}</button>
        </form>
        <p class="py-switch">${link('/sign-in', 'Back to sign in')}</p></section>`;
    };
    return component(el, s, render, (el, api) => {
      sync(el, s);
      el.querySelector('form')?.addEventListener('submit', async (e) => {
        e.preventDefault(); s.submitted = true;
        if (emailErr(s.email, true)) { api.paint(); return PY.focusFirstInvalid(el); }
        api.set({ busy: true });
        await Store.forgotPassword(s.email); // same answer whether or not the account exists
        api.set({ busy: false, sentTo: s.email.trim() });
      });
      el.querySelector('#open-link')?.addEventListener('click', () => Router.navigate('/reset-password' + qs({ token: Store.pendingToken(Store.currentUser()?.email || s.sentTo, 'RESET') || 'missing' })));
    });
  }

  /* ---------- reset password ---------- */
  function resetPassword(ctx, el) {
    const s = { newPassword: '', submitted: false, busy: false, state: 'form', alert: null };
    const lengthMet = () => s.newPassword.length >= MIN_LEN;
    const render = (s) => {
      if (s.state === 'done') return `<section aria-labelledby="reset-title">${badge('check')}${head('reset-title', 'Password changed', "For your security, you've been signed out everywhere. Sign in with your new password.")}<a class="py-btn py-btn--primary py-btn--block" href="#/sign-in">Sign in</a></section>`;
      if (s.state === 'expired') return `<section aria-labelledby="reset-title">${head('reset-title', 'This link has expired', 'Reset links work once and last 1 hour. Request a new one.')}<a class="py-btn py-btn--primary py-btn--block" href="#/forgot-password">Send a new link</a></section>`;
      const pErr = s.submitted && !s.newPassword ? 'Choose a password.' : s.submitted && !lengthMet() ? `Use at least ${MIN_LEN} characters.` : null;
      return `<section aria-labelledby="reset-title">
        ${head('reset-title', 'Choose a new password', "You'll be signed out of every device after the change.")}
        ${s.alert ? alertBox(s.alert) : ''}
        <form class="py-form" novalidate>
          ${field({ label: 'New password', id: 'rp-password', error: pErr, body: passwordInput({ id: 'rp-password', name: 'newPassword', value: s.newPassword, autocomplete: 'new-password', error: pErr, describedBy: 'rp-password-rules' })
            + `<div class="rules" id="rp-password-rules" aria-live="polite"><span class="rule${lengthMet() ? ' is-met' : ''}" data-rule>${icon(lengthMet() ? 'check' : 'dot')}${MIN_LEN}+ characters</span></div>` })}
          <button class="py-btn py-btn--primary py-btn--block" type="submit" ${s.busy ? 'disabled' : ''}>${submitLabel(s.busy, 'Saving', 'Change password')}</button>
        </form></section>`;
    };
    return component(el, s, render, (el, api) => {
      sync(el, s, (name) => {
        const rule = el.querySelector('[data-rule]');
        rule.classList.toggle('is-met', lengthMet()); rule.firstElementChild.setAttribute('name', lengthMet() ? 'check' : 'dot');
      });
      el.querySelector('form')?.addEventListener('submit', async (e) => {
        e.preventDefault(); s.submitted = true; s.alert = null;
        if (!lengthMet()) { api.paint(); return PY.focusFirstInvalid(el); }
        api.set({ busy: true });
        try { await Store.resetPassword({ token: ctx.query.token, newPassword: s.newPassword }); api.set({ busy: false, state: 'done' }); }
        catch (err) { api.set(err.code === 'TOKEN_EXPIRED' ? { busy: false, state: 'expired' } : { busy: false, alert: err.message }); }
      });
    });
  }

  /* ---------- portal picker ---------- */
  function portalPicker(ctx, el) {
    const me = Store.currentUser();
    return component(el, {}, () => `<div class="portal-picker"><section aria-labelledby="portals-title">
      ${head('portals-title', 'Choose a portal', `You're a member of ${me.portals.length} portals as ${esc(me.email)}.`)}
      <div class="portals" role="list">${me.portals.map((p) => `<button class="portal" type="button" role="listitem" data-slug="${esc(p.slug)}">
        <span class="portal__tile">${esc(initials(p.name))}</span>
        <span class="portal__meta"><span class="portal__name">${esc(p.name)}</span><span class="py-caption">${esc(p.profileName)} · ${esc(p.slug)}.projecty.app</span></span>${icon('chevron-right')}</button>`).join('')}</div>
      <div class="actions">
        <button class="py-btn py-btn--ghost" type="button" id="out">${icon('arrow-left')}Sign out</button>
        <a class="py-btn py-btn--ghost" href="#/portals/new">${icon('plus')}Create a portal</a>
      </div></section></div>`, (el) => {
      el.querySelectorAll('[data-slug]').forEach((b) => b.addEventListener('click', () => Router.navigate(`/p/${b.dataset.slug}`)));
      el.querySelector('#out').addEventListener('click', () => { Store.signOut(); Router.navigate('/sign-in'); });
    });
  }

  /* ---------- create portal ---------- */
  function createPortal(ctx, el) {
    const me = Store.currentUser();
    const firstPortal = me.portals.length === 0;
    draft.fullName = me.fullName; draft.portalName = ''; draft.slug = '';
    const s = { name: '', slug: '', terms: false, submitted: false, busy: false, alert: null, slugStatus: { kind: 'idle' } };
    let slugEdited = false, checkTimer = null, checkSeq = 0;

    const slugValid = () => SLUG_PATTERN.test(s.slug) && s.slug.length >= SLUG_MIN && s.slug.length <= SLUG_MAX;
    const slugErr = () => !s.submitted ? null : !s.slug ? 'Choose a portal address.' : s.slug.length < SLUG_MIN ? `Use at least ${SLUG_MIN} characters.`
      : s.slug.length > SLUG_MAX ? `Use ${SLUG_MAX} characters or fewer.` : !SLUG_PATTERN.test(s.slug) ? "Use letters, numbers and hyphens; it can't start or end with a hyphen." : null;
    const slugRegion = () => {
      const st = s.slugStatus;
      const status = st.kind === 'checking' ? '<p class="py-field__hint">Checking…</p>'
        : st.kind === 'available' ? `<p class="py-field__ok">${icon('check')}${esc(s.slug)}.projecty.app is available</p>`
        : st.kind === 'unavailable' ? `<p class="py-field__error">${icon('alert')}${esc(s.slug)}.projecty.app is taken.</p>` : '';
      const sugg = st.kind === 'unavailable' && st.suggestions.length
        ? `<div class="suggestions"><span class="py-caption">Try</span>${st.suggestions.map((x) => `<button class="suggestion" type="button" data-suggestion="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : '';
      return `<div id="cp-slug-status" aria-live="polite">${status}</div>${sugg}`;
    };
    const render = (s) => {
      const nErr = s.submitted && !s.name.trim() ? 'Name your portal. You can rename it later.' : s.submitted && s.name.length > 100 ? 'Use 100 characters or fewer.' : null;
      const sErr = slugErr();
      const tErr = s.submitted && !s.terms ? 'Accept the terms to create your portal.' : null;
      return `<div class="create-portal">${firstPortal ? stepper(2, 'Your portal') : ''}
      <section aria-labelledby="portal-title">
        ${head('portal-title', 'Set up your portal', "A portal is your organization's space. Projects, people and settings live inside it.")}
        ${s.alert ? alertBox(s.alert) : ''}
        <form class="py-form" novalidate>
          ${field({ label: 'Portal name', id: 'cp-name', error: nErr, body: input({ id: 'cp-name', name: 'name', value: s.name, autocomplete: 'organization', placeholder: 'Northwind Labs', error: nErr }) })}
          ${field({ label: 'Portal address', id: 'cp-slug', error: sErr, hint: s.slugStatus.kind === 'idle' ? "Lowercase letters, numbers and hyphens. You can't change this later." : null,
            body: `<div class="py-input-wrap slug"><input id="cp-slug" name="slug" type="text" value="${esc(s.slug)}" autocomplete="off" spellcheck="false" placeholder="northwind-labs" ${sErr ? 'aria-invalid="true"' : ''} aria-describedby="cp-slug-status" /><span class="py-input-wrap__suffix">.projecty.app</span></div><div id="cp-slug-region">${slugRegion()}</div>` })}
          <div class="py-field${tErr ? ' is-invalid' : ''}">
            <label class="py-check"><input type="checkbox" name="terms" ${s.terms ? 'checked' : ''} ${tErr ? 'aria-invalid="true"' : ''} /><span>I agree to the Terms of service and Privacy policy</span></label>
            ${tErr ? `<p class="py-field__error">${icon('alert')}${tErr}</p>` : ''}
          </div>
          <button class="py-btn py-btn--primary py-btn--block" type="submit" ${s.busy ? 'disabled' : ''}>${submitLabel(s.busy, 'Creating portal', 'Create portal')}</button>
        </form>
        ${!firstPortal ? `<p class="py-switch">${link('/portals', 'Back to your portals')}</p>` : ''}
      </section></div>`;
    };
    return component(el, s, render, (el, api) => {
      const repaintSlug = () => {
        el.querySelector('#cp-slug-region').innerHTML = slugRegion();
        el.querySelector('#cp-slug').closest('.py-field').classList.toggle('is-invalid', s.slugStatus.kind === 'unavailable' || !!slugErr());
        el.querySelectorAll('[data-suggestion]').forEach((b) => b.addEventListener('click', () => useSuggestion(b.dataset.suggestion)));
      };
      const scheduleCheck = () => {
        clearTimeout(checkTimer);
        s.slugStatus = { kind: slugValid() ? 'checking' : 'idle' };
        repaintSlug();
        if (!slugValid()) return;
        const seq = ++checkSeq;
        checkTimer = setTimeout(async () => {
          const slug = s.slug, res = await Store.slugStatus(slug);
          if (seq !== checkSeq || !document.body.contains(el)) return; // a newer keystroke won
          s.slugStatus = res.available ? { kind: 'available' } : { kind: 'unavailable', suggestions: res.suggestions };
          repaintSlug(); // region only: a full repaint would steal focus from whatever is being typed
        }, SLUG_CHECK_DELAY_MS);
      };
      const setSlug = (v) => { s.slug = v; draft.slug = v; el.querySelector('#cp-slug').value = v; paintPreview(); scheduleCheck(); };
      const useSuggestion = (x) => { slugEdited = true; setSlug(x); };

      sync(el, s, (name, node) => {
        if (name === 'name') {
          draft.portalName = s.name; paintPreview();
          if (!slugEdited) setSlug(slugify(s.name));
        }
        if (name === 'slug') {
          const clean = node.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
          if (clean !== node.value) node.value = clean;
          slugEdited = clean.length > 0; setSlug(clean);
        }
      });
      repaintSlug();
      el.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault(); s.submitted = true; s.alert = null;
        if (!s.name.trim() || s.name.length > 100 || !slugValid() || !s.terms) { api.paint(); return PY.focusFirstInvalid(el); }
        api.set({ busy: true });
        try { const portal = await Store.createPortal({ name: s.name.trim(), slug: s.slug }); Router.navigate(`/p/${portal.slug}`); }
        catch (err) {
          if (err.code === 'SLUG_TAKEN') { api.set({ busy: false, slugStatus: { kind: 'unavailable', suggestions: [] } }); }
          else api.set({ busy: false, alert: err.message });
        }
      });
    });
  }

  /* ---------- accept invite ---------- */
  function acceptInvite(ctx, el) {
    const tokenValue = ctx.query.token;
    const s = { preview: null, loadError: null, fullName: '', password: '', submitted: false, busy: false, error: null };
    const me = () => Store.currentUser();
    const render = (s) => {
      if (s.loadError) return `<section aria-labelledby="invite-title">${head('invite-title', 'Invitation not available', esc(s.loadError))}<a class="py-btn py-btn--secondary py-btn--block" href="#/sign-in">Go to sign in</a></section>`;
      const p = s.preview;
      if (!p) return `<section aria-labelledby="invite-title" aria-live="polite">${head('invite-title', 'Opening your invitation…')}</section>`;
      if (!p.valid) return `<section aria-labelledby="invite-title">${head('invite-title', 'This invitation has expired', `Invitations work once and last 7 days. Ask ${esc(p.invitedByName ?? 'an admin of ' + p.portalName)} for a new one.`)}<a class="py-btn py-btn--secondary py-btn--block" href="#/sign-in">Go to sign in</a></section>`;
      const nErr = s.submitted && !s.fullName.trim() ? 'Enter your full name.' : null;
      const pErr = s.submitted && s.password.length < MIN_LEN ? `Use at least ${MIN_LEN} characters.` : null;
      const signedInAsInvitee = me()?.email.toLowerCase() === p.email.toLowerCase();
      const returnUrl = `/invite${qs({ token: tokenValue })}`;
      let body;
      if (!p.accountExists) {
        body = `<form class="py-form" novalidate>
          ${field({ label: 'Work email', id: 'ai-email', body: input({ id: 'ai-email', name: 'email', type: 'email', value: p.email, disabled: true }) })}
          ${field({ label: 'Full name', id: 'ai-name', error: nErr, body: input({ id: 'ai-name', name: 'fullName', value: s.fullName, autocomplete: 'name', error: nErr }) })}
          ${field({ label: 'Password', id: 'ai-password', error: pErr, hint: `${MIN_LEN}+ characters`, body: passwordInput({ id: 'ai-password', name: 'password', value: s.password, autocomplete: 'new-password', error: pErr }) })}
          <button class="py-btn py-btn--primary py-btn--block" type="submit" ${s.busy ? 'disabled' : ''}>${submitLabel(s.busy, 'Joining', 'Create account and join')}</button></form>`;
      } else if (signedInAsInvitee) {
        body = `<button class="py-btn py-btn--primary py-btn--block" type="button" id="join" ${s.busy ? 'disabled' : ''}>${submitLabel(s.busy, 'Joining', `Join ${esc(p.portalName)}`)}</button>`;
      } else if (me()) {
        body = `<div class="py-alert" role="status">${icon('alert')}<span>You're signed in as ${esc(me().email)}. This invitation is for ${esc(p.email)}.</span></div>
          <button class="py-btn py-btn--secondary py-btn--block" type="button" id="signout">Sign out to accept</button>`;
      } else {
        body = `<a class="py-btn py-btn--primary py-btn--block" href="#/sign-in${qs({ returnUrl })}">Sign in to accept</a><p class="py-switch">You already have a ProjectY account with this email.</p>`;
      }
      return `<section aria-labelledby="invite-title" aria-live="polite">${badge('mail')}
        ${head('invite-title', `Join ${esc(p.portalName)}`, `${esc(p.invitedByName ?? 'An admin')} invited <strong>${esc(p.email)}</strong> to join as ${esc(p.profileName)}.`)}
        ${s.error ? alertBox(s.error) : ''}${body}</section>`;
    };
    const c = component(el, s, render, (el, api) => {
      sync(el, s);
      const go = async (extra) => {
        api.set({ busy: true, error: null });
        try { const { slug } = await Store.acceptInvite(tokenValue, extra); Router.navigate(`/p/${slug}`); }
        catch (err) { api.set({ busy: false, error: err.message }); }
      };
      el.querySelector('form')?.addEventListener('submit', (e) => {
        e.preventDefault(); s.submitted = true;
        if (!s.fullName.trim() || s.password.length < MIN_LEN) { api.paint(); return PY.focusFirstInvalid(el); }
        go({ fullName: s.fullName, password: s.password });
      });
      el.querySelector('#join')?.addEventListener('click', () => go());
      el.querySelector('#signout')?.addEventListener('click', () => { Store.signOut(); api.paint(); });
    });
    if (!tokenValue) c.set({ loadError: 'This invitation link is not valid.' });
    else Store.invitePreview(tokenValue).then((preview) => c.set({ preview }), (err) => c.set({ loadError: err.message }));
    return c;
  }

  /* ---------- small static screens ---------- */
  function portalNotFound(ctx, el) {
    const removed = ctx.query.reason === 'removed';
    el.innerHTML = `<section aria-labelledby="pnf-title">${removed
      ? head('pnf-title', 'You no longer have access', "An admin of this portal removed your access. Your other portals still work.")
      : head('pnf-title', 'Portal not found', "This portal doesn't exist, or you're not a member of it.")}
      <a class="py-btn py-btn--primary py-btn--block" href="#${landingUrl()}">Go to your portals</a></section>`;
  }
  function supportEnded(ctx, el) {
    el.innerHTML = `<section aria-labelledby="ended-title">${badge('check')}${head('ended-title', 'Support session ended', "You're signed out of the user's account. You can close this tab.")}</section>`;
  }

  return { layout, landingUrl, signIn, signUp, checkEmail, verifyEmail, forgotPassword, resetPassword, portalPicker, createPortal, acceptInvite, portalNotFound, supportEnded };
})();
