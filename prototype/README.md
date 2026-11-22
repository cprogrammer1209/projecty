# ProjectY prototype

Plain HTML, CSS and JS for designing screens before they go into `frontend/` (Angular). It looks and behaves like the frontend does today. It never calls `platform-service`; a mock backend in `localStorage` stands in for it.

## Run it

Open `index.html` in a browser (double-click is fine, no server or build). Routes are hash-based, e.g. `index.html#/p/northwind-labs/settings/users`.

Demo logins (password `password123`):

| Email | What you get |
|---|---|
| `priya@northwind.com` | Admin and owner of Northwind Labs, Employee in Acme Studio (two portals, so you see the picker) |
| `ravi@northwind.com` | Employee in Northwind Labs (no manage controls) |

"Reset demo data" in the sign-in footer restores the seed. Anything labelled **Prototype only** (the mailbox stand-in buttons, demo-login note, reset link) is not part of the real UI; drop it when porting.

## Layout

```
css/tokens.css     copy of frontend/src/styles/projecty-tokens.css
css/base.css       frontend/src/styles.scss (global classes: py-btn, py-field, py-menu, ...)
css/auth.css       auth layout, showcases, portal picker, create portal
css/shell.css      sidebar + top bar
css/home.css       home
css/settings.css   settings card, users table, dialogs
js/icon.js         <py-icon> element
js/core.js         helpers: field(), input(), dates, theme, router, component()
js/store.js        the mock backend (all fake data and rules live here)
js/views/*.js      one file per area: auth, shell, home, settings
js/app.js          route table and guards
```

Component CSS is scoped with a wrapper class (`.shell`, `.home`, `.users-page`, ...), standing in for Angular's view encapsulation. When you port a screen, drop the prefix and put the rules in the component's `.scss`.

## Adding a screen

1. Add `css/<name>.css` and link it in `index.html`; add `js/views/<name>.js` and a `<script>` tag before `app.js`.
2. Write the view as `mount(el, ctx)` (signed in, inside the shell) or `(ctx, el)` (signed out). `ctx` has `me`, `portal`, `can(permission)`, `timeZone`.
3. Register it in `js/app.js` with `portalRoute(...)` or `authRoute(...)`. Add a sidebar item in `views/shell.js` if it needs one.
4. Need data? Add methods to `js/store.js` that return the same shapes the API will (and throw `{ code, message }` on errors).

## Porting a screen to Angular

- Class names, tokens and `<py-icon name="...">` are the same as in the app, so markup copies across. Turn the template strings back into `@if` / `@for`, and the `s.xxx` state into signals.
- Use the shared pieces instead of the helpers: `<py-field>` for `field()`, `<py-password-input>` for `passwordInput()`, `ThemeService`, the router.
- Use the real services instead of `Store`: `AuthService`, `ActivePortalService`, `PortalApi`, `MemberApi`, and read `response.data` / `error.code`.
- New backend work follows the rules in the root `CLAUDE.md` (feature module, portal-scoped, permission, outbox event).

## Differences from the app

- Email, reset and invitation links are buttons (the app uses Mailpit).
- Latency is a fixed 350ms; the real app has refresh-token rotation, lockout and the support-session screens, which are only shown here as static pages.
