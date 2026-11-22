# ProjectY prototypes

Plain HTML, CSS and JS for designing screens before they go into `frontend/` (Angular). No backend: a mock in `localStorage` stands in for the services. Each step has its **own folder with its own copy** of the prototype, so any step can be opened on its own.

```
prototype/
  m0/                    M0 Foundation: sign-in and sign-up, portals, Home, Settings (Portal, Users, Audit log, My preferences)
    prototype.html
    css/  js/  assets/
  m1/
    step4/               M1 Step 4 Projects: M0 plus Projects list, create/edit, overview with members, trash
      prototype.html
      css/  js/  assets/
    step7/               M1 Step 7 Custom fields: Step 4 plus a Linear-style Settings (Portal; Modules → Projects: Fields, Layouts with the visual canvas layout builder, Statuses, Templates; other modules marked Soon), and custom fields on the project form and overview, grouped in the layout's sections
      prototype.html
      css/  js/  assets/
    explorations/        one-off comparisons, not part of a step (inline-edit.html: HubSpot, Zoho and Linear style editing)
    step5/ ...           added when each step is built, copied from the step before
```

The plan for what each step contains is in [`docs/project-plan.html`](../docs/project-plan.html) (open it, click a module).

## Run it

Open a step's `prototype.html` in a browser (double-click is fine, no server or build). Routes are hash-based, e.g. `m1/step4/prototype.html#/p/northwind-labs/projects`.

The step 7 mock store (`js/store.js`) mirrors the layout API of `work-service` (`GET /layouts/active`, `PUT /layouts/{id}`, `PUT /projects/{id}/layout`), so the Angular port is mechanical.

The Angular app (`frontend/`) has the Step 7 screens (Settings shell, fields, layouts and the layout builder, project form, overview and project settings) and this prototype matches it, including: every project property (name, owner, start and end date, who can see it, description) saves on its own from the overview's "About this project" card, and the Edit form still sends everything (`Store.updateProject` is partial by presence, like `PATCH /api/work/projects/{id}`); leaving the layout builder with unsaved changes asks first; the Fields list has no "Used by" column (the count is in the delete dialog); saved choices of a field cannot be reordered, new ones can. One difference left on purpose: the prototype always shows people's names in person pickers, while the Angular app shows "Unknown member" to people without `USERS_VIEW`.

Demo logins (password `password123`):

| Email | What you get |
|---|---|
| `priya@northwind.com` | Admin and owner of Northwind Labs, Employee in Acme Studio (two portals, so you see the picker) |
| `sara@northwind.com` | Manager in Northwind Labs (owns two projects) |
| `ravi@northwind.com` | Employee in Northwind Labs (no manage controls) |

"Reset demo data" in the sign-in footer restores that step's seed. Each step saves to its own `localStorage` key (`py-proto-m0`, `py-proto-m1-step4`, ...), so steps don't overwrite each other. Anything labelled **Prototype only** (mailbox stand-in buttons, demo-login note, reset link) is not part of the real UI; drop it when porting.

## Inside a step

```
css/tokens.css     copy of frontend/src/styles/projecty-tokens.css
css/base.css       frontend/src/styles.scss (global classes: py-btn, py-field, py-menu, ...)
css/*.css          one file per area (auth, shell, home, settings, projects)
js/icon.js         <py-icon> element
js/core.js         helpers: field(), input(), dates, theme, router, component()
js/store.js        the mock backend (all fake data and rules live here)
js/views/*.js      one file per area
js/app.js          route table and guards
```

Component CSS is scoped with a wrapper class (`.shell`, `.home`, `.users-page`, `.projects-page`, ...), standing in for Angular's view encapsulation. When you port a screen, drop the prefix and put the rules in the component's `.scss`.

## Starting the next step

1. Copy the previous step's folder (`cp -r m1/step4 m1/step5`), give `js/store.js` its own `KEY`, and set the `<title>` in `prototype.html`.
2. Add `css/<name>.css` and `js/views/<name>.js`, link them in `prototype.html`, register the routes in `js/app.js` (`portalRoute(...)`), and add the sidebar item in `js/views/shell.js`.
3. Mock data and rules go in `js/store.js`; throw `{ code, message }` for errors, like the real API will.
4. Update the module's plan in `docs/project-plan.data.js` (tasks, `protoUrl`, history).

## Porting a screen to Angular

- Class names, tokens and `<py-icon name="...">` are the same as in the app, so markup copies across. Turn the template strings back into `@if` / `@for`, and the `s.xxx` state into signals.
- Use the shared pieces instead of the helpers: `<py-field>` for `field()`, `<py-password-input>` for `passwordInput()`, `ThemeService`, the router.
- Use the real services instead of `Store`: `AuthService`, `ActivePortalService`, `PortalApi`, `MemberApi`, and read `response.data` / `error.code`.
- New backend work follows the rules in the root `CLAUDE.md` (feature module, portal-scoped, permission, outbox event).

## Differences from the app

- Email, reset and invitation links are buttons (the app uses Mailpit).
- Latency is a fixed 350ms. The real app's refresh-token rotation, lockout and support-session screens are not simulated.
- Project progress is always 0% and task counts show "—" until Tasks (Step 6) exist.
