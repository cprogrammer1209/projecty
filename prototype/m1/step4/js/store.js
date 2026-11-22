/*
 * Mock backend. Stands in for platform-service so every flow works with no server.
 * State lives in localStorage ('py-proto-v1'); `Store.reset()` (or the footer link on sign-in) restores the seed.
 * Methods are async and throw { code, message } like an AppResponse error, so views read `err.code`.
 *
 * M1 Step 4 adds projects, project members, trash and the PROJECTS_* permissions.
 *
 * Demo logins (password for all: password123):
 *   priya@northwind.com   Admin + owner of Northwind Labs, Employee in Acme Studio (two portals -> picker)
 *   ravi@northwind.com    Employee in Northwind Labs
 */
const Store = (() => {
  const KEY = 'py-proto-m1-step4';
  const LATENCY_MS = 350;
  const HOUR = 3600e3, DAY = 24 * HOUR;

  /** Same as MemberConstants.SYSTEM_PROFILES. */
  const PROFILES = [
    { id: 'ADMIN', name: 'Admin', description: 'Everything, including portal settings and users.', permissions: ['PORTAL_SETTINGS_MANAGE', 'USERS_VIEW', 'USERS_MANAGE', 'AUDIT_VIEW', 'PROJECTS_VIEW', 'PROJECTS_CREATE', 'PROJECTS_EDIT', 'PROJECTS_DELETE'] },
    { id: 'MANAGER', name: 'Manager', description: 'Runs projects. Sees the people in the portal.', permissions: ['USERS_VIEW', 'PROJECTS_VIEW', 'PROJECTS_CREATE', 'PROJECTS_EDIT', 'PROJECTS_DELETE'] },
    { id: 'EMPLOYEE', name: 'Employee', description: 'Works on assigned items. Sees the people in the portal.', permissions: ['USERS_VIEW', 'PROJECTS_VIEW'] },
    { id: 'CLIENT', name: 'Client', description: 'External user. Sees only what is shared with them.', permissions: ['PROJECTS_VIEW'] },
  ];
  const profileOf = (id) => PROFILES.find((p) => p.id === id);
  /** Actions that can appear in a portal's log, with the label shown in the UI. */
  const AUDIT_ACTIONS = [
    ['PORTAL_CREATED', 'Portal created'], ['PORTAL_SETTINGS_CHANGED', 'Portal settings changed'], ['USER_INVITED', 'User invited'],
    ['INVITATION_REVOKED', 'Invitation withdrawn'], ['INVITATION_ACCEPTED', 'Invitation accepted'], ['USER_PROFILE_CHANGED', 'Profile changed'],
    ['USER_DEACTIVATED', 'User deactivated'], ['USER_REACTIVATED', 'User reactivated'], ['IMPERSONATION_STARTED', 'Support session started'],
    ['PROJECT_CREATED', 'Project created'], ['PROJECT_UPDATED', 'Project updated'], ['PROJECT_STATUS_CHANGED', 'Project status changed'],
    ['PROJECT_TRASHED', 'Project moved to trash'], ['PROJECT_RESTORED', 'Project restored'], ['PROJECT_MEMBER_ADDED', 'Project member added'], ['PROJECT_MEMBER_REMOVED', 'Project member removed'],
  ];
  /** Portal-level project statuses (PRJ default list). `type` is Active / Completed / On hold / Cancelled. */
  const PROJECT_STATUSES = [
    { name: 'Active', type: 'Active' }, { name: 'In Progress', type: 'Active' }, { name: 'On Track', type: 'Active' }, { name: 'Delayed', type: 'Active' },
    { name: 'On Hold', type: 'On hold' }, { name: 'Completed', type: 'Completed' }, { name: 'Cancelled', type: 'Cancelled' },
  ];
  const KEY_PATTERN = /^[A-Z0-9]{2,10}$/;
  const RESERVED_SLUGS = ['admin', 'api', 'app', 'www', 'support', 'projecty'];

  function seed() {
    const now = Date.now();
    const user = (id, email, fullName) => ({ id, email, fullName, password: 'password123', verified: true, timeZone: null });
    return {
      users: [
        user('u1', 'priya@northwind.com', 'Priya Nair'),
        user('u2', 'ravi@northwind.com', 'Ravi Kumar'),
        user('u3', 'sara@northwind.com', 'Sara Lopez'),
        user('u4', 'tom@northwind.com', 'Tom Becker'),
        user('u5', 'maya@northwind.com', 'Maya Chen'),
        user('u6', 'jo@acme.studio', 'Jo Alvarez'),
      ],
      portals: [
        { id: 'p1', name: 'Northwind Labs', slug: 'northwind-labs', timeZone: 'Asia/Kolkata', dateFormat: 'MMM d, yyyy', currency: 'USD', weekStart: 'MONDAY' },
        { id: 'p2', name: 'Acme Studio', slug: 'acme-studio', timeZone: 'America/New_York', dateFormat: 'MM/dd/yyyy', currency: 'USD', weekStart: 'SUNDAY' },
      ],
      members: [
        { portalId: 'p1', userId: 'u1', profile: 'ADMIN', owner: true, status: 'ACTIVE', lastLoginAt: now - 5 * 60e3 },
        { portalId: 'p1', userId: 'u2', profile: 'EMPLOYEE', owner: false, status: 'ACTIVE', lastLoginAt: now - 3 * HOUR },
        { portalId: 'p1', userId: 'u3', profile: 'MANAGER', owner: false, status: 'ACTIVE', lastLoginAt: now - 1 * DAY },
        { portalId: 'p1', userId: 'u4', profile: 'EMPLOYEE', owner: false, status: 'DEACTIVATED', lastLoginAt: now - 40 * DAY },
        { portalId: 'p1', userId: 'u5', profile: 'CLIENT', owner: false, status: 'ACTIVE', lastLoginAt: null },
        { portalId: 'p2', userId: 'u6', profile: 'ADMIN', owner: true, status: 'ACTIVE', lastLoginAt: now - 2 * DAY },
        { portalId: 'p2', userId: 'u1', profile: 'EMPLOYEE', owner: false, status: 'ACTIVE', lastLoginAt: now - 1 * HOUR },
      ],
      invitations: [
        { id: 'i1', portalId: 'p1', email: 'new.hire@northwind.com', profile: 'EMPLOYEE', invitedBy: 'u1', expiresAt: now + 5 * DAY, token: 'inv-seed-1' },
      ],
      emailTokens: [],
      /** Portal audit log, newest appended last. Same fields as AuditEventResponseDTO (portal-less AUTH events never show here). */
      auditLog: [
        { id: 'a1', portalId: 'p1', occurredAt: now - 30 * DAY, category: 'ADMIN', action: 'PORTAL_CREATED', actorType: 'USER', actorName: 'Priya Nair', targetName: null, detail: 'Created portal Northwind Labs' },
        { id: 'a2', portalId: 'p1', occurredAt: now - 29 * DAY, category: 'ADMIN', action: 'USER_INVITED', actorType: 'USER', actorName: 'Priya Nair', targetName: 'ravi@northwind.com', detail: 'Invited as Employee' },
        { id: 'a3', portalId: 'p1', occurredAt: now - 28 * DAY, category: 'ADMIN', action: 'INVITATION_ACCEPTED', actorType: 'USER', actorName: 'Ravi Kumar', targetName: 'Ravi Kumar', detail: 'Joined as Employee' },
        { id: 'a4', portalId: 'p1', occurredAt: now - 20 * DAY, category: 'ADMIN', action: 'USER_PROFILE_CHANGED', actorType: 'USER', actorName: 'Priya Nair', targetName: 'Sara Lopez', detail: 'Profile: Employee → Manager' },
        { id: 'a5', portalId: 'p1', occurredAt: now - 14 * DAY, category: 'ADMIN', action: 'PORTAL_SETTINGS_CHANGED', actorType: 'USER', actorName: 'Priya Nair', targetName: null, detail: 'timeZone: UTC → Asia/Kolkata' },
        { id: 'a6', portalId: 'p1', occurredAt: now - 9 * DAY, category: 'ADMIN', action: 'USER_DEACTIVATED', actorType: 'USER', actorName: 'Priya Nair', targetName: 'Tom Becker', detail: 'Deactivated' },
        { id: 'a7', portalId: 'p1', occurredAt: now - 2 * DAY, category: 'ADMIN', action: 'IMPERSONATION_STARTED', actorType: 'ADMIN', actorName: 'Support (platform admin)', targetName: 'Priya Nair', detail: 'Support session, 30 minutes: help with invitations' },
        { id: 'a8', portalId: 'p1', projectId: 'pr1', occurredAt: now - 48 * DAY, category: 'ADMIN', action: 'PROJECT_CREATED', actorType: 'USER', actorName: 'Priya Nair', targetName: 'WEB · Website Redesign', detail: 'Created project' },
        { id: 'a9', portalId: 'p1', projectId: 'pr1', occurredAt: now - 30 * DAY, category: 'ADMIN', action: 'PROJECT_STATUS_CHANGED', actorType: 'USER', actorName: 'Priya Nair', targetName: 'WEB · Website Redesign', detail: 'Status: Active → In Progress' },
        { id: 'a10', portalId: 'p1', projectId: 'pr5', occurredAt: now - 3 * DAY, category: 'ADMIN', action: 'PROJECT_TRASHED', actorType: 'USER', actorName: 'Priya Nair', targetName: 'OLD · Legacy Migration', detail: 'Moved to trash' },
      ],
      /** Projects of every portal. `deletedAt` set = in the trash. Dates are plain yyyy-mm-dd. */
      projects: [
        { id: 'pr1', portalId: 'p1', key: 'WEB', name: 'Website Redesign', description: 'New marketing site: content models, design system and launch.', ownerId: 'u1', status: 'In Progress', startDate: '2026-10-05', endDate: '2026-12-18', visibility: 'PUBLIC', createdAt: now - 48 * DAY, deletedAt: null, deletedBy: null },
        { id: 'pr2', portalId: 'p1', key: 'MOB', name: 'Mobile App', description: 'Customer app for iOS and Android. Private while we pick a vendor.', ownerId: 'u3', status: 'On Track', startDate: '2026-09-14', endDate: '2027-01-29', visibility: 'PRIVATE', createdAt: now - 70 * DAY, deletedAt: null, deletedBy: null },
        { id: 'pr3', portalId: 'p1', key: 'API', name: 'Public API', description: 'Versioned REST API for partners, with docs and keys.', ownerId: 'u3', status: 'Active', startDate: '2026-11-02', endDate: '2027-02-26', visibility: 'PUBLIC', createdAt: now - 20 * DAY, deletedAt: null, deletedBy: null },
        { id: 'pr4', portalId: 'p1', key: 'OPS', name: 'Ops Onboarding', description: 'Playbook and tooling for onboarding new support staff.', ownerId: 'u1', status: 'Completed', startDate: '2026-06-01', endDate: '2026-09-30', visibility: 'PRIVATE', createdAt: now - 150 * DAY, deletedAt: null, deletedBy: null },
        { id: 'pr5', portalId: 'p1', key: 'OLD', name: 'Legacy Migration', description: 'Dropped after the vendor change.', ownerId: 'u1', status: 'Cancelled', startDate: null, endDate: null, visibility: 'PRIVATE', createdAt: now - 90 * DAY, deletedAt: now - 3 * DAY, deletedBy: 'u1' },
        { id: 'pr6', portalId: 'p2', key: 'BRD', name: 'Brand Refresh', description: 'Logo, colors and the new brand guide.', ownerId: 'u6', status: 'Active', startDate: '2026-11-09', endDate: '2027-01-15', visibility: 'PUBLIC', createdAt: now - 12 * DAY, deletedAt: null, deletedBy: null },
      ],
      projectMembers: [
        { projectId: 'pr1', userId: 'u1', role: 'Manager' }, { projectId: 'pr1', userId: 'u2', role: 'Member' }, { projectId: 'pr1', userId: 'u3', role: 'Member' },
        { projectId: 'pr2', userId: 'u3', role: 'Manager' }, { projectId: 'pr2', userId: 'u2', role: 'Member' },
        { projectId: 'pr3', userId: 'u3', role: 'Manager' }, { projectId: 'pr3', userId: 'u1', role: 'Member' },
        { projectId: 'pr4', userId: 'u1', role: 'Manager' }, { projectId: 'pr5', userId: 'u1', role: 'Manager' },
        { projectId: 'pr6', userId: 'u6', role: 'Manager' }, { projectId: 'pr6', userId: 'u1', role: 'Member' },
      ],
      sessionUserId: null,
      lastSignup: null,
    };
  }

  let db = load();
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || seed(); } catch (e) { return seed(); } }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };
  const fail = (code, message) => { throw Object.assign(new Error(message), { code, message }); };
  /** Runs `fn` after a short delay so spinners and busy states are visible. */
  const call = async (fn) => { await PY.delay(LATENCY_MS); const out = fn(); save(); return out; };
  const token = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  const byEmail = (email) => db.users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
  const userById = (id) => db.users.find((u) => u.id === id);
  const portalById = (id) => db.portals.find((p) => p.id === id);
  const portalBySlug = (slug) => db.portals.find((p) => p.slug === slug);
  const sessionUser = () => userById(db.sessionUserId);
  const requireUser = () => sessionUser() || fail('UNAUTHENTICATED', 'Sign in to continue.');
  const membership = (portalId, userId) => db.members.find((m) => m.portalId === portalId && m.userId === userId);
  /** Appends an audit event for the signed-in user (the real server writes these in the same transaction as the change). */
  const record = (portalId, action, { target = null, detail = null, category = 'ADMIN', actor = sessionUser(), projectId = null } = {}) => {
    db.auditLog.push({ id: 'a' + token(), portalId, projectId, occurredAt: Date.now(), category, action, actorType: 'USER', actorName: actor?.fullName ?? 'Someone', targetName: target, detail });
  };
  const issue = (type, email, ttl) => { const t = { token: token(), type, email, expiresAt: Date.now() + ttl, used: false }; db.emailTokens.push(t); return t; };

  function toMe(u) {
    return {
      id: u.id, email: u.email, fullName: u.fullName, timeZone: u.timeZone,
      portals: db.members.filter((m) => m.userId === u.id && m.status === 'ACTIVE').map((m) => {
        const p = portalById(m.portalId);
        return { id: p.id, name: p.name, slug: p.slug, profile: m.profile, profileName: profileOf(m.profile).name };
      }),
    };
  }
  function toMember(m) {
    const u = userById(m.userId), p = profileOf(m.profile);
    return { userId: u.id, fullName: u.fullName, email: u.email, profileId: p.id, profileName: p.name, owner: m.owner, status: m.status, lastLoginAt: m.lastLoginAt };
  }
  const toInvitation = (i) => ({ id: i.id, email: i.email, profileName: profileOf(i.profile).name, invitedByName: userById(i.invitedBy)?.fullName ?? 'An admin', expiresAt: i.expiresAt });

  /** An admin of the portal, checked per call (the real server checks the permission on every endpoint). */
  function requirePermission(portalId, permission) {
    const user = requireUser();
    const m = membership(portalId, user.id);
    if (!m || m.status !== 'ACTIVE') fail('NOT_A_MEMBER', 'You are not a member of this portal.');
    if (!profileOf(m.profile).permissions.includes(permission)) fail('FORBIDDEN', 'Your profile does not allow this.');
    return { user, m };
  }

  /* ---------- projects (M1 Step 4) ---------- */
  const projectById = (portalId, id) => db.projects.find((p) => p.portalId === portalId && p.id === id);
  const projMembers = (id) => db.projectMembers.filter((m) => m.projectId === id);
  const projectRole = (id, userId) => projMembers(id).find((m) => m.userId === userId)?.role ?? null;
  const addProjMember = (id, userId, role) => { if (!projectRole(id, userId)) db.projectMembers.push({ projectId: id, userId, role }); };
  /** PRJ-BR-06: Admins see everything; others see projects they are in, plus public ones (never for Clients unless a member). */
  const canSee = (p, user, mship) => mship.profile === 'ADMIN' || !!projectRole(p.id, user.id) || (p.visibility === 'PUBLIC' && mship.profile !== 'CLIENT');
  /** Edit needs PROJECTS_EDIT and either Admin, the owner, or the Manager project role. Delete: Admin or the owner (PRJ-BR-10). */
  const canEditProject = (p, user, mship) => profileOf(mship.profile).permissions.includes('PROJECTS_EDIT') && (mship.profile === 'ADMIN' || p.ownerId === user.id || projectRole(p.id, user.id) === 'Manager');
  const canDeleteProject = (p, user, mship) => profileOf(mship.profile).permissions.includes('PROJECTS_DELETE') && (mship.profile === 'ADMIN' || p.ownerId === user.id);
  const needProject = (portalId, id, { trashed = false } = {}) => {
    const { user, m } = requirePermission(portalId, 'PROJECTS_VIEW');
    const p = projectById(portalId, id);
    if (!p || !!p.deletedAt !== trashed || !(canSee(p, user, m) || (trashed && canDeleteProject(p, user, m)))) fail('PROJECT_NOT_FOUND', 'That project does not exist, or you cannot see it.');
    return { p, user, m };
  };
  const enrich = (p, user, m) => ({
    id: p.id, key: p.key, name: p.name, description: p.description, status: p.status, startDate: p.startDate, endDate: p.endDate, visibility: p.visibility,
    owner: { id: p.ownerId, name: userById(p.ownerId)?.fullName ?? 'Unknown' }, memberCount: projMembers(p.id).length, progress: 0, // progress arrives with Tasks (Step 6)
    isMember: !!projectRole(p.id, user.id), canEdit: canEditProject(p, user, m), canDelete: canDeleteProject(p, user, m),
  });
  function validateProject(portalId, f, { creating }) {
    if (!String(f.name || '').trim()) fail('VALIDATION', 'Name the project.');
    if (String(f.name).length > 100) fail('VALIDATION', 'Use 100 characters or fewer.');
    if (creating) {
      if (!KEY_PATTERN.test(f.key || '')) fail('VALIDATION', 'Use 2 to 10 capital letters or numbers for the key.');
      if (db.projects.some((p) => p.portalId === portalId && p.key === f.key)) fail('KEY_TAKEN', `The key ${f.key} is already used in this portal.`);
    }
    if (f.startDate && f.endDate && f.endDate < f.startDate) fail('VALIDATION', "The end date can't be before the start date.");
  }

  return {
    PROFILES, profileOf, PROJECT_STATUSES,
    reset() { db = seed(); save(); },

    /* ----- session / account ----- */
    isSignedIn: () => !!sessionUser(),
    currentUser: () => (sessionUser() ? toMe(sessionUser()) : null),
    /** The most recent sign-up, so check-email knows the address and the dev link can find its token. */
    lastSignup: () => db.lastSignup,
    clearLastSignup() { db.lastSignup = null; save(); },
    pendingToken: (email, type) => [...db.emailTokens].reverse().find((t) => t.email.toLowerCase() === String(email).toLowerCase() && t.type === type && !t.used)?.token ?? null,

    signUp: ({ fullName, email, password }) => call(() => {
      if (byEmail(email)) fail('EMAIL_TAKEN', 'An account with this email already exists.');
      db.users.push({ id: 'u' + token(), email: email.trim(), fullName: fullName.trim(), password, verified: false, timeZone: null });
      issue('VERIFY', email.trim(), DAY);
      db.lastSignup = { email: email.trim(), fullName: fullName.trim() };
    }),
    resendVerification: (email) => call(() => { if (byEmail(email) && !byEmail(email).verified) issue('VERIFY', byEmail(email).email, DAY); }),
    verifyEmail: (tokenValue) => call(() => {
      const t = db.emailTokens.find((x) => x.token === tokenValue && x.type === 'VERIFY');
      if (!t || t.used) fail('TOKEN_INVALID', 'This confirmation link is not valid. It may have been used already.');
      if (t.expiresAt < Date.now()) fail('TOKEN_EXPIRED', 'This link has expired.');
      t.used = true; byEmail(t.email).verified = true;
    }),
    signIn: ({ email, password }) => call(() => {
      const u = byEmail(email);
      if (!u || u.password !== password) fail('INVALID_CREDENTIALS', "That email and password don't match.");
      if (!u.verified) fail('EMAIL_NOT_VERIFIED', 'Confirm your email first.');
      db.sessionUserId = u.id;
      db.members.filter((m) => m.userId === u.id).forEach((m) => { m.lastLoginAt = Date.now(); });
      return toMe(u);
    }),
    signOut() { db.sessionUserId = null; save(); },
    forgotPassword: (email) => call(() => { const u = byEmail(email); if (u) issue('RESET', u.email, HOUR); }),
    resetPassword: ({ token: tokenValue, newPassword }) => call(() => {
      const t = db.emailTokens.find((x) => x.token === tokenValue && x.type === 'RESET');
      if (!t || t.used || t.expiresAt < Date.now()) fail('TOKEN_EXPIRED', 'This link has expired.');
      t.used = true; byEmail(t.email).password = newPassword; db.sessionUserId = null;
    }),
    updatePreferences: (timeZone) => call(() => { requireUser().timeZone = timeZone; return toMe(sessionUser()); }),

    /* ----- portals ----- */
    slugStatus: (slug) => call(() => {
      const taken = !!portalBySlug(slug) || RESERVED_SLUGS.includes(slug);
      if (!taken) return { available: true, suggestions: [] };
      const suggestions = [`${slug}-hq`, `${slug}-team`, `${slug}-${new Date().getFullYear()}`].filter((s) => s.length <= 30 && !portalBySlug(s)).slice(0, 3);
      return { available: false, suggestions };
    }),
    createPortal: ({ name, slug }) => call(() => {
      const user = requireUser();
      if (portalBySlug(slug) || RESERVED_SLUGS.includes(slug)) fail('SLUG_TAKEN', `${slug}.projecty.app is taken.`);
      const portal = { id: 'p' + token(), name, slug, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', dateFormat: 'MMM d, yyyy', currency: 'USD', weekStart: 'MONDAY' };
      db.portals.push(portal);
      db.members.push({ portalId: portal.id, userId: user.id, profile: 'ADMIN', owner: true, status: 'ACTIVE', lastLoginAt: Date.now() });
      record(portal.id, 'PORTAL_CREATED', { detail: `Created portal ${name}` });
      return portal;
    }),
    /** Activating a portal: its settings plus my membership and permissions, or a reason it can't be opened. */
    openPortal: (slug) => {
      const user = requireUser();
      const portal = portalBySlug(slug);
      const m = portal && membership(portal.id, user.id);
      if (!portal || !m) return { result: 'not-member' };
      if (m.status !== 'ACTIVE') return { result: 'removed' };
      return { result: 'ok', portal: { ...portal }, membership: { profileName: profileOf(m.profile).name, owner: m.owner, permissions: profileOf(m.profile).permissions } };
    },
    updatePortal: (portalId, patch) => call(() => {
      requirePermission(portalId, 'PORTAL_SETTINGS_MANAGE');
      const before = { ...portalById(portalId) };
      const changes = Object.keys(patch).filter((k) => patch[k] !== before[k]).map((k) => `${k}: ${before[k]} → ${patch[k]}`);
      if (changes.length) record(portalId, 'PORTAL_SETTINGS_CHANGED', { detail: changes.join('; ') });
      Object.assign(portalById(portalId), patch);
      return { ...portalById(portalId) };
    }),

    /* ----- members / invitations ----- */
    members: (portalId) => call(() => { requirePermission(portalId, 'USERS_VIEW'); return db.members.filter((m) => m.portalId === portalId).map(toMember); }),
    invitations: (portalId) => call(() => { requirePermission(portalId, 'USERS_MANAGE'); return db.invitations.filter((i) => i.portalId === portalId).map(toInvitation); }),
    invite: (portalId, { email, profileId }) => call(() => {
      const { user } = requirePermission(portalId, 'USERS_MANAGE');
      const existing = byEmail(email);
      if (existing && membership(portalId, existing.id)) fail('ALREADY_MEMBER', 'That person is already in this portal.');
      db.invitations = db.invitations.filter((i) => !(i.portalId === portalId && i.email.toLowerCase() === email.trim().toLowerCase()));
      const inv = { id: 'i' + token(), portalId, email: email.trim(), profile: profileId, invitedBy: user.id, expiresAt: Date.now() + 7 * DAY, token: 'inv-' + token() };
      db.invitations.push(inv);
      record(portalId, 'USER_INVITED', { target: inv.email, detail: `Invited as ${profileOf(profileId).name}` });
      return { ...toInvitation(inv), token: inv.token };
    }),
    resendInvitation: (portalId, id) => call(() => {
      requirePermission(portalId, 'USERS_MANAGE');
      const inv = db.invitations.find((i) => i.id === id); inv.expiresAt = Date.now() + 7 * DAY; return { email: inv.email, token: inv.token };
    }),
    revokeInvitation: (portalId, id) => call(() => {
      requirePermission(portalId, 'USERS_MANAGE');
      const inv = db.invitations.find((i) => i.id === id);
      if (inv) record(portalId, 'INVITATION_REVOKED', { target: inv.email, detail: 'Invitation withdrawn' });
      db.invitations = db.invitations.filter((i) => i.id !== id);
    }),
    changeProfile: (portalId, userId, profileId) => call(() => {
      requirePermission(portalId, 'USERS_MANAGE');
      const m = membership(portalId, userId);
      if (m.owner) fail('OWNER_LOCKED', 'The owner always stays an active Admin.');
      record(portalId, 'USER_PROFILE_CHANGED', { target: userById(userId).fullName, detail: `Profile: ${profileOf(m.profile).name} → ${profileOf(profileId).name}` });
      m.profile = profileId;
    }),
    setActive: (portalId, userId, active) => call(() => {
      requirePermission(portalId, 'USERS_MANAGE');
      const m = membership(portalId, userId);
      if (m.owner) fail('OWNER_LOCKED', 'The owner always stays an active Admin.');
      m.status = active ? 'ACTIVE' : 'DEACTIVATED';
      record(portalId, active ? 'USER_REACTIVATED' : 'USER_DEACTIVATED', { target: userById(userId).fullName, detail: active ? 'Reactivated' : 'Deactivated' });
    }),

    /** GET /api/audit-events: newest first, filtered, paged like PagedResponse. Page is 0-based, size max 100. */
    auditEvents: (portalId, { category = '', action = '', page = 0, size = 25 } = {}) => call(() => {
      requirePermission(portalId, 'AUDIT_VIEW');
      const all = db.auditLog.filter((e) => e.portalId === portalId && (!category || e.category === category) && (!action || e.action === action))
        .sort((a, b) => b.occurredAt - a.occurredAt);
      const sz = Math.min(Math.max(size, 1), 100);
      return { items: all.slice(page * sz, page * sz + sz), page, size: sz, totalItems: all.length, totalPages: Math.max(1, Math.ceil(all.length / sz)) };
    }),
    auditActions: () => AUDIT_ACTIONS,

    /* ----- projects ----- */
    projects: (portalId) => call(() => {
      const { user, m } = requirePermission(portalId, 'PROJECTS_VIEW');
      return db.projects.filter((p) => p.portalId === portalId && !p.deletedAt && canSee(p, user, m)).map((p) => enrich(p, user, m));
    }),
    project: (portalId, id) => call(() => {
      const { p, user, m } = needProject(portalId, id);
      const activity = db.auditLog.filter((e) => e.projectId === id).sort((a, b) => b.occurredAt - a.occurredAt).slice(0, 6);
      const members = projMembers(id).map((pm) => ({ userId: pm.userId, fullName: userById(pm.userId).fullName, email: userById(pm.userId).email, role: pm.role, owner: pm.userId === p.ownerId }));
      return { ...enrich(p, user, m), members, activity };
    }),
    trashedProjects: (portalId) => call(() => {
      const { user, m } = requirePermission(portalId, 'PROJECTS_VIEW');
      return db.projects.filter((p) => p.portalId === portalId && p.deletedAt && canDeleteProject(p, user, m))
        .map((p) => ({ ...enrich(p, user, m), deletedAt: p.deletedAt, deletedBy: userById(p.deletedBy)?.fullName ?? 'Unknown' }));
    }),
    /** People who can own or join a project: the portal's active members. */
    projectPeople: (portalId) => call(() => {
      requirePermission(portalId, 'PROJECTS_VIEW');
      return db.members.filter((x) => x.portalId === portalId && x.status === 'ACTIVE').map((x) => ({ userId: x.userId, fullName: userById(x.userId).fullName, profileName: profileOf(x.profile).name }));
    }),
    keyStatus: (portalId, key) => call(() => ({ available: KEY_PATTERN.test(key) && !db.projects.some((p) => p.portalId === portalId && p.key === key) })),
    createProject: (portalId, f) => call(() => {
      const { user } = requirePermission(portalId, 'PROJECTS_CREATE');
      validateProject(portalId, f, { creating: true });
      const ownerId = f.ownerId || user.id;
      if (!membership(portalId, ownerId)) fail('VALIDATION', 'The owner must be a member of this portal.');
      const p = { id: 'pr' + token(), portalId, key: f.key, name: f.name.trim(), description: (f.description || '').trim(), ownerId, status: 'Active', startDate: f.startDate || null, endDate: f.endDate || null, visibility: f.visibility || 'PRIVATE', createdAt: Date.now(), deletedAt: null, deletedBy: null };
      db.projects.push(p);
      addProjMember(p.id, ownerId, 'Manager'); // PRJ-BR-05: the owner is always a Manager member
      record(portalId, 'PROJECT_CREATED', { target: `${p.key} · ${p.name}`, detail: 'Created project', projectId: p.id });
      return { id: p.id };
    }),
    updateProject: (portalId, id, f) => call(() => {
      const { p, user, m } = needProject(portalId, id);
      if (!canEditProject(p, user, m)) fail('FORBIDDEN', 'Your profile or project role does not allow editing this project.');
      validateProject(portalId, f, { creating: false });
      const changes = [];
      const set = (field, value, label) => { if ((p[field] || null) !== (value || null)) { changes.push(label); p[field] = value || (field === 'description' ? '' : null); } };
      set('name', f.name.trim(), 'name'); set('description', (f.description || '').trim(), 'description'); set('startDate', f.startDate, 'start date'); set('endDate', f.endDate, 'end date'); set('visibility', f.visibility, 'visibility');
      if (f.ownerId && f.ownerId !== p.ownerId) {
        if (!membership(portalId, f.ownerId)) fail('VALIDATION', 'The owner must be a member of this portal.');
        addProjMember(p.id, f.ownerId, 'Manager'); db.projectMembers.find((x) => x.projectId === p.id && x.userId === f.ownerId).role = 'Manager'; // the old owner stays a member (PRJ-BR-05)
        p.ownerId = f.ownerId; changes.push('owner');
      }
      if (changes.length) record(portalId, 'PROJECT_UPDATED', { target: `${p.key} · ${p.name}`, detail: `Changed ${changes.join(', ')}`, projectId: p.id });
    }),
    setProjectStatus: (portalId, id, status) => call(() => {
      const { p, user, m } = needProject(portalId, id);
      if (!canEditProject(p, user, m)) fail('FORBIDDEN', 'Your profile or project role does not allow changing the status.');
      if (!PROJECT_STATUSES.some((s) => s.name === status)) fail('VALIDATION', 'Unknown status.');
      if (p.status === status) return;
      record(portalId, 'PROJECT_STATUS_CHANGED', { target: `${p.key} · ${p.name}`, detail: `Status: ${p.status} → ${status}`, projectId: p.id });
      p.status = status;
    }),
    deleteProject: (portalId, id) => call(() => {
      const { p, user, m } = needProject(portalId, id);
      if (!canDeleteProject(p, user, m)) fail('FORBIDDEN', 'Only the project owner or an Admin can delete a project.');
      p.deletedAt = Date.now(); p.deletedBy = user.id;
      record(portalId, 'PROJECT_TRASHED', { target: `${p.key} · ${p.name}`, detail: 'Moved to trash', projectId: p.id });
    }),
    restoreProject: (portalId, id) => call(() => {
      const { p, user, m } = needProject(portalId, id, { trashed: true });
      if (!canDeleteProject(p, user, m)) fail('FORBIDDEN', 'Only the project owner or an Admin can restore a project.');
      p.deletedAt = null; p.deletedBy = null;
      record(portalId, 'PROJECT_RESTORED', { target: `${p.key} · ${p.name}`, detail: 'Restored from trash', projectId: p.id });
    }),
    addProjectMember: (portalId, id, { userId, role }) => call(() => {
      const { p, user, m } = needProject(portalId, id);
      if (!canEditProject(p, user, m)) fail('FORBIDDEN', 'Only a project Manager or an Admin can change the members.');
      const target = membership(portalId, userId);
      if (!target || target.status !== 'ACTIVE') fail('VALIDATION', 'Only active people in this portal can join a project.');
      if (projectRole(id, userId)) fail('ALREADY_MEMBER', 'That person is already in this project.');
      addProjMember(id, userId, role === 'Manager' ? 'Manager' : 'Member');
      record(portalId, 'PROJECT_MEMBER_ADDED', { target: userById(userId).fullName, detail: `Added to ${p.key} as ${role === 'Manager' ? 'Manager' : 'Member'}`, projectId: id });
    }),
    removeProjectMember: (portalId, id, userId) => call(() => {
      const { p, user, m } = needProject(portalId, id);
      if (!canEditProject(p, user, m)) fail('FORBIDDEN', 'Only a project Manager or an Admin can change the members.');
      if (userId === p.ownerId) fail('OWNER_LOCKED', 'The owner always stays a member. Change the owner first.');
      db.projectMembers = db.projectMembers.filter((x) => !(x.projectId === id && x.userId === userId));
      record(portalId, 'PROJECT_MEMBER_REMOVED', { target: userById(userId).fullName, detail: `Removed from ${p.key}`, projectId: id });
    }),

    /* ----- accepting an invitation ----- */
    invitePreview: (tokenValue) => call(() => {
      const inv = db.invitations.find((i) => i.token === tokenValue);
      if (!inv) fail('INVITATION_INVALID', 'This invitation link is not valid. It may have been withdrawn.');
      return { valid: inv.expiresAt > Date.now(), email: inv.email, portalName: portalById(inv.portalId).name, profileName: profileOf(inv.profile).name,
        invitedByName: userById(inv.invitedBy)?.fullName ?? null, accountExists: !!byEmail(inv.email) };
    }),
    acceptInvite: (tokenValue, { fullName, password } = {}) => call(() => {
      const inv = db.invitations.find((i) => i.token === tokenValue);
      if (!inv || inv.expiresAt < Date.now()) fail('INVITATION_INVALID', 'This invitation has expired.');
      let user = byEmail(inv.email);
      if (!user) { user = { id: 'u' + token(), email: inv.email, fullName: fullName.trim(), password, verified: true, timeZone: null }; db.users.push(user); }
      else if (db.sessionUserId !== user.id) fail('FORBIDDEN', 'Sign in as the invited person to accept.');
      db.members.push({ portalId: inv.portalId, userId: user.id, profile: inv.profile, owner: false, status: 'ACTIVE', lastLoginAt: Date.now() });
      db.invitations = db.invitations.filter((i) => i !== inv);
      db.sessionUserId = user.id;
      record(inv.portalId, 'INVITATION_ACCEPTED', { target: user.fullName, detail: `Joined as ${profileOf(inv.profile).name}` });
      return { slug: portalById(inv.portalId).slug };
    }),
  };
})();
