/*
 * Mock backend. Stands in for platform-service so every flow works with no server.
 * State lives in localStorage ('py-proto-v1'); `Store.reset()` (or the footer link on sign-in) restores the seed.
 * Methods are async and throw { code, message } like an AppResponse error, so views read `err.code`.
 *
 * M1 Step 4 adds projects, project members, trash and the PROJECTS_* permissions.
 * Step 7 adds layouts (sections, placements, per-layout overrides) and custom fields on projects (CUSTOM_FIELDS_VIEW / CUSTOM_FIELDS_MANAGE), with the same rules as work-service's validator.
 *
 * Step 6 adds task lists, tasks (sequential KEY-T<n> ids, subtasks to depth 5, statuses from the task layout, comments, activity, followers, tags, trash)
 * and the TASK entity in the customization engine (fields, layouts, layout statuses). Rules mirror docs/requirements/06-tasks.md (TSK-BR-01..18 subset).
 *
 * Demo logins (password for all: password123):
 *   priya@northwind.com   Admin + owner of Northwind Labs, Employee in Acme Studio (two portals -> picker)
 *   ravi@northwind.com    Employee in Northwind Labs
 */
const Store = (() => {
  const KEY = 'py-proto-m1-step6-tasks';
  const LATENCY_MS = 350;
  const HOUR = 3600e3, DAY = 24 * HOUR;

  /** Same as MemberConstants.SYSTEM_PROFILES. */
  const PROFILES = [
    { id: 'ADMIN', name: 'Admin', description: 'Everything, including portal settings and users.', permissions: ['PORTAL_SETTINGS_MANAGE', 'USERS_VIEW', 'USERS_MANAGE', 'AUDIT_VIEW', 'PROJECTS_VIEW', 'PROJECTS_CREATE', 'PROJECTS_EDIT', 'PROJECTS_DELETE', 'CUSTOM_FIELDS_VIEW', 'CUSTOM_FIELDS_MANAGE', 'TASKS_VIEW', 'TASKS_CREATE', 'TASKS_EDIT', 'TASKS_DELETE'] },
    { id: 'MANAGER', name: 'Manager', description: 'Runs projects. Sees the people in the portal.', permissions: ['USERS_VIEW', 'PROJECTS_VIEW', 'PROJECTS_CREATE', 'PROJECTS_EDIT', 'PROJECTS_DELETE', 'CUSTOM_FIELDS_VIEW', 'TASKS_VIEW', 'TASKS_CREATE', 'TASKS_EDIT', 'TASKS_DELETE'] },
    { id: 'EMPLOYEE', name: 'Employee', description: 'Works on assigned items. Sees the people in the portal.', permissions: ['USERS_VIEW', 'PROJECTS_VIEW', 'CUSTOM_FIELDS_VIEW', 'TASKS_VIEW', 'TASKS_CREATE', 'TASKS_EDIT'] },
    { id: 'CLIENT', name: 'Client', description: 'External user. Sees only what is shared with them.', permissions: ['PROJECTS_VIEW', 'CUSTOM_FIELDS_VIEW', 'TASKS_VIEW'] },
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


  /* ---------- Step 6 seed: TASK fields, layouts with statuses, lists, tasks, comments ---------- */
  /** Status colours a layout status can use (key -> CSS colour). Same set the Statuses screen offers. */
  const STATUS_COLORS = [['gray', 'Gray', '#8e9199'], ['blue', 'Blue', '#4d7cf0'], ['green', 'Green', '#2f9e6f'], ['amber', 'Amber', '#d9962b'], ['red', 'Red', '#cf4238'], ['purple', 'Purple', '#8b5cf6'], ['teal', 'Teal', '#14a3b8'], ['pink', 'Pink', '#d9488b']];
  const defaultStatuses = () => [
    { id: 'st' + token(), name: 'Open', type: 'OPEN', color: 'gray', isDefault: true, sortOrder: 0 },
    { id: 'st' + token(), name: 'In Progress', type: 'OPEN', color: 'blue', isDefault: false, sortOrder: 1 },
    { id: 'st' + token(), name: 'Closed', type: 'CLOSED', color: 'green', isDefault: false, sortOrder: 2 },
  ];
  function seedTasks(data, now) {
    const st = (id, name, type, color, isDefault, sortOrder) => ({ id, name, type, color, isDefault, sortOrder });
    const fld = (id, portalId, apiName, label, type, extra = {}) => ({ id, portalId, entityType: 'TASK', apiName, label, description: '', type, mandatory: false, unique: false, sensitive: false, defaultValue: null, config: {}, status: 'ACTIVE', sortOrder: 0, options: [], ...extra });
    data.customFields.push(
      fld('f9', 'p1', 'cf_work_type', 'Work type', 'PICKLIST', { description: 'What kind of work this is.', sortOrder: 0, options: [{ id: 'o8', label: 'Feature', active: true }, { id: 'o9', label: 'Bug', active: true }, { id: 'o10', label: 'Chore', active: true }] }),
      fld('f10', 'p1', 'cf_needs_qa', 'Needs QA', 'CHECKBOX', { sortOrder: 1, defaultValue: false }),
      fld('f11', 'p1', 'cf_story_points', 'Story points', 'NUMBER', { sortOrder: 2, config: { min: 0, max: 100 } }));
    const pl = (apiName, extra = {}) => ({ apiName, mandatory: null, readOnly: false, defaultValue: null, ...extra });
    data.layouts.push(
      { id: 'l4', entityType: 'TASK', portalId: 'p1', name: 'Standard', description: 'Open, In Progress and Closed.', isDefault: true, active: true,
        statuses: [st('st1', 'Open', 'OPEN', 'gray', true, 0), st('st2', 'In Progress', 'OPEN', 'blue', false, 1), st('st3', 'Closed', 'CLOSED', 'green', false, 2)],
        sections: [{ id: 's5', name: 'Details', collapsible: false, fields: [pl('cf_work_type'), pl('cf_needs_qa'), pl('cf_story_points')] }] },
      { id: 'l5', entityType: 'TASK', portalId: 'p1', name: 'Delivery', description: 'A review step before work is done.', isDefault: false, active: true,
        statuses: [st('st4', 'To do', 'OPEN', 'gray', true, 0), st('st5', 'In review', 'OPEN', 'amber', false, 1), st('st6', 'Done', 'CLOSED', 'green', false, 2), st('st7', 'Cancelled', 'CLOSED', 'red', false, 3)],
        sections: [{ id: 's6', name: 'Planning', collapsible: true, fields: [pl('cf_story_points'), pl('cf_work_type')] }] },
      { id: 'l6', entityType: 'TASK', portalId: 'p2', name: 'Standard', description: '', isDefault: true, active: true,
        statuses: [st('st8', 'Open', 'OPEN', 'gray', true, 0), st('st9', 'In Progress', 'OPEN', 'blue', false, 1), st('st10', 'Closed', 'CLOSED', 'green', false, 2)],
        sections: [{ id: 's7', name: 'Details', collapsible: false, fields: [] }] });
    data.projects.find((p) => p.id === 'pr2').taskLayoutId = 'l5';
    const day = (n) => new Date(Date.UTC(2026, 10, 23 + n)).toISOString().slice(0, 10);
    data.taskLists = [
      { id: 'tl1', portalId: 'p1', projectId: 'pr1', name: 'General', isDefault: true, flag: 'INTERNAL', archived: false, sortOrder: 0 },
      { id: 'tl2', portalId: 'p1', projectId: 'pr1', name: 'Design', isDefault: false, flag: 'INTERNAL', archived: false, sortOrder: 1 },
      { id: 'tl3', portalId: 'p1', projectId: 'pr1', name: 'Build', isDefault: false, flag: 'INTERNAL', archived: false, sortOrder: 2 },
      { id: 'tl4', portalId: 'p1', projectId: 'pr2', name: 'General', isDefault: true, flag: 'INTERNAL', archived: false, sortOrder: 0 },
    ];
    let n = 0;
    const T = (projectId, key, listId, seq, title, o = {}) => ({ id: 't' + (++n), portalId: 'p1', projectId, listId, parentId: null, seq, key: `${key}-T${seq}`, title, description: '', ownerIds: [], statusId: null,
      priority: 'NONE', startDate: null, dueDate: null, workHours: null, completion: 0, prevCompletion: null, tags: [], followerIds: [], customValues: {}, createdBy: 'u1', createdAt: now - 20 * DAY, closedAt: null, deletedAt: null, deletedBy: null, deletedWith: null, ...o });
    data.tasks = [
      T('pr1', 'WEB', 'tl1', 1, 'Audit current site content', { ownerIds: ['u1'], statusId: 'st3', priority: 'MEDIUM', startDate: day(-48), dueDate: day(-37), completion: 100, closedAt: now - 30 * DAY, description: 'List every page, who owns it and whether it moves to the new site.' }),
      T('pr1', 'WEB', 'tl2', 2, 'Define design tokens', { ownerIds: ['u2', 'u3'], statusId: 'st2', priority: 'HIGH', startDate: day(-35), dueDate: day(4), workHours: 24, completion: 40, tags: ['design', 'tokens'], followerIds: ['u1'], customValues: { cf_work_type: 'o8', cf_story_points: 8 }, description: 'Colour, type and spacing tokens, shared with the Angular app.' }),
      T('pr1', 'WEB', 'tl2', 3, 'Colour palette', { parentId: 't2', ownerIds: ['u2'], statusId: 'st3', priority: 'MEDIUM', completion: 100, closedAt: now - 3 * DAY }),
      T('pr1', 'WEB', 'tl2', 4, 'Typography scale', { parentId: 't2', ownerIds: ['u3'], statusId: 'st2', priority: 'MEDIUM', dueDate: day(2), completion: 20 }),
      T('pr1', 'WEB', 'tl3', 5, 'Build page templates', { ownerIds: ['u3'], statusId: 'st1', priority: 'MEDIUM', startDate: day(7), dueDate: day(18), workHours: 40, tags: ['frontend'], customValues: { cf_work_type: 'o8' } }),
      T('pr1', 'WEB', 'tl3', 6, 'Set up CI for the site', { ownerIds: ['u2'], statusId: 'st2', priority: 'HIGH', dueDate: day(-3), completion: 60, tags: ['infra'], customValues: { cf_work_type: 'o10' } }),
      T('pr1', 'WEB', 'tl1', 7, 'Write launch checklist', { statusId: 'st1' }),
      T('pr1', 'WEB', 'tl3', 8, 'Accessibility pass', { ownerIds: ['u1'], statusId: 'st1', priority: 'CRITICAL', dueDate: day(21), customValues: { cf_work_type: 'o9', cf_needs_qa: true } }),
      T('pr2', 'MOB', 'tl4', 1, 'Pick a vendor', { createdBy: 'u3', ownerIds: ['u3'], statusId: 'st5', priority: 'HIGH', dueDate: day(6), customValues: { cf_story_points: 5 } }),
      T('pr2', 'MOB', 'tl4', 2, 'Draft app store listing', { createdBy: 'u3', ownerIds: ['u2'], statusId: 'st4', priority: 'LOW' }),
    ];
    data.tasks.forEach((t) => { t.followerIds = [...new Set([t.createdBy, ...t.ownerIds, ...t.followerIds])]; }); // creator and owners follow (TSK-BR-12)
    data.projects.find((p) => p.id === 'pr1').taskSeq = 8; data.projects.find((p) => p.id === 'pr2').taskSeq = 2;
    data.taskComments = [
      { id: 'c1', portalId: 'p1', taskId: 't2', authorId: 'u2', body: 'I started with the colour tokens. Spacing next.', createdAt: now - 4 * DAY, editedAt: null },
      { id: 'c2', portalId: 'p1', taskId: 't2', authorId: 'u1', body: 'Good. Please keep the names the same as in the Angular app.', createdAt: now - 3 * DAY, editedAt: null },
    ];
    data.taskActivity = data.tasks.map((t) => ({ id: 'ta' + t.id, portalId: 'p1', taskId: t.id, at: t.createdAt, actorId: t.createdBy, action: 'CREATED', field: null, from: null, to: null, text: 'Created the task' }));
    data.taskActivity.push({ id: 'tax1', portalId: 'p1', taskId: 't2', at: now - 5 * DAY, actorId: 'u3', action: 'FIELD', field: 'Priority', from: 'Medium', to: 'High', text: null },
      { id: 'tax2', portalId: 'p1', taskId: 't2', at: now - 4 * DAY, actorId: 'u2', action: 'STATUS', field: 'Status', from: 'Open', to: 'In Progress', text: null });
    return data;
  }

  function seed() {
    const now = Date.now();
    const user = (id, email, fullName) => ({ id, email, fullName, password: 'password123', verified: true, timeZone: null });
    const data = {
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
        { id: 'pr1', portalId: 'p1', key: 'WEB', name: 'Website Redesign', description: 'New marketing site: content models, design system and launch.', ownerId: 'u1', status: 'In Progress', startDate: '2026-10-05', endDate: '2026-12-18', visibility: 'PUBLIC', createdAt: now - 48 * DAY, deletedAt: null, deletedBy: null, customValues: { cf_customer_tier: "o1", cf_budget: 12000, cf_go_live: "2026-12-01", cf_vip: true, cf_channels: ["o5", "o6"], cf_account_manager: "u1" }, layoutId: 'l1' },
        { id: 'pr2', portalId: 'p1', key: 'MOB', name: 'Mobile App', description: 'Customer app for iOS and Android. Private while we pick a vendor.', ownerId: 'u3', status: 'On Track', startDate: '2026-09-14', endDate: '2027-01-29', visibility: 'PRIVATE', createdAt: now - 70 * DAY, deletedAt: null, deletedBy: null, customValues: { cf_customer_tier: "o2", cf_budget: 8500.5, cf_go_live: "2027-01-29", cf_vip: false, cf_channels: ["o4"] }, layoutId: 'l2' },
        { id: 'pr3', portalId: 'p1', key: 'API', name: 'Public API', description: 'Versioned REST API for partners, with docs and keys.', ownerId: 'u3', status: 'Active', startDate: '2026-11-02', endDate: '2027-02-26', visibility: 'PUBLIC', createdAt: now - 20 * DAY, deletedAt: null, deletedBy: null, customValues: { cf_customer_tier: "o3", cf_budget: 30000 }, layoutId: 'l1' },
        { id: 'pr4', portalId: 'p1', key: 'OPS', name: 'Ops Onboarding', description: 'Playbook and tooling for onboarding new support staff.', ownerId: 'u1', status: 'Completed', startDate: '2026-06-01', endDate: '2026-09-30', visibility: 'PRIVATE', createdAt: now - 150 * DAY, deletedAt: null, deletedBy: null, customValues: { cf_customer_tier: "o2", cf_budget: 4000, cf_vip: false }, layoutId: 'l1' },
        { id: 'pr5', portalId: 'p1', key: 'OLD', name: 'Legacy Migration', description: 'Dropped after the vendor change.', ownerId: 'u1', status: 'Cancelled', startDate: null, endDate: null, visibility: 'PRIVATE', createdAt: now - 90 * DAY, deletedAt: now - 3 * DAY, deletedBy: 'u1', customValues: {}, layoutId: 'l1' },
        { id: 'pr6', portalId: 'p2', key: 'BRD', name: 'Brand Refresh', description: 'Logo, colors and the new brand guide.', ownerId: 'u6', status: 'Active', startDate: '2026-11-09', endDate: '2027-01-15', visibility: 'PUBLIC', createdAt: now - 12 * DAY, deletedAt: null, deletedBy: null, customValues: { cf_region: "EMEA" }, layoutId: 'l3' },
      ],
      projectMembers: [
        { projectId: 'pr1', userId: 'u1', role: 'Manager' }, { projectId: 'pr1', userId: 'u2', role: 'Member' }, { projectId: 'pr1', userId: 'u3', role: 'Member' },
        { projectId: 'pr2', userId: 'u3', role: 'Manager' }, { projectId: 'pr2', userId: 'u2', role: 'Member' },
        { projectId: 'pr3', userId: 'u3', role: 'Manager' }, { projectId: 'pr3', userId: 'u1', role: 'Member' },
        { projectId: 'pr4', userId: 'u1', role: 'Manager' }, { projectId: 'pr5', userId: 'u1', role: 'Manager' },
        { projectId: 'pr6', userId: 'u6', role: 'Manager' }, { projectId: 'pr6', userId: 'u1', role: 'Member' },
      ],
      /**
       * Custom field definitions (work-service: custom_field + custom_field_option). Answers live on the record in `customValues`,
       * keyed by apiName. status: ACTIVE | INACTIVE | DELETED (a DELETED row stays so its key is never reused).
       */
      customFields: [
        { id: 'f1', portalId: 'p1', entityType: 'PROJECT', apiName: 'cf_customer_tier', label: 'Customer tier', description: 'How important this customer is to us.', type: 'PICKLIST', mandatory: true, unique: false, sensitive: false, defaultValue: 'o2', config: {}, status: 'ACTIVE', sortOrder: 0,
          options: [{ id: 'o1', label: 'Gold', active: true }, { id: 'o2', label: 'Silver', active: true }, { id: 'o3', label: 'Bronze', active: true }] },
        { id: 'f2', portalId: 'p1', entityType: 'PROJECT', apiName: 'cf_budget', label: 'Budget', description: 'Approved budget in the portal currency.', type: 'DECIMAL', mandatory: false, unique: false, sensitive: true, defaultValue: null, config: { min: 0, decimals: 2 }, status: 'ACTIVE', sortOrder: 1, options: [] },
        { id: 'f3', portalId: 'p1', entityType: 'PROJECT', apiName: 'cf_go_live', label: 'Go-live', description: '', type: 'DATE', mandatory: false, unique: false, sensitive: false, defaultValue: null, config: {}, status: 'ACTIVE', sortOrder: 2, options: [] },
        { id: 'f4', portalId: 'p1', entityType: 'PROJECT', apiName: 'cf_vip', label: 'VIP', description: '', type: 'CHECKBOX', mandatory: false, unique: false, sensitive: false, defaultValue: false, config: {}, status: 'ACTIVE', sortOrder: 3, options: [] },
        { id: 'f5', portalId: 'p1', entityType: 'PROJECT', apiName: 'cf_channels', label: 'Channels', description: 'Where the work will be published.', type: 'MULTI_PICKLIST', mandatory: false, unique: false, sensitive: false, defaultValue: null, config: { minSelect: 0, maxSelect: 3 }, status: 'ACTIVE', sortOrder: 4,
          options: [{ id: 'o4', label: 'Web', active: true }, { id: 'o5', label: 'iOS', active: true }, { id: 'o6', label: 'Android', active: true }, { id: 'o7', label: 'Print', active: false }] },
        { id: 'f6', portalId: 'p1', entityType: 'PROJECT', apiName: 'cf_account_manager', label: 'Account manager', description: 'The person who talks to the customer.', type: 'USER', mandatory: false, unique: false, sensitive: false, defaultValue: null, config: {}, status: 'ACTIVE', sortOrder: 5, options: [] },
        { id: 'f7', portalId: 'p1', entityType: 'PROJECT', apiName: 'cf_contract_no', label: 'Contract number', description: 'Must be different on every project.', type: 'TEXT', mandatory: false, unique: true, sensitive: false, defaultValue: null, config: { maxLength: 20 }, status: 'INACTIVE', sortOrder: 6, options: [] },
        { id: 'f8', portalId: 'p2', entityType: 'PROJECT', apiName: 'cf_region', label: 'Region', description: '', type: 'TEXT', mandatory: false, unique: false, sensitive: false, defaultValue: null, config: { maxLength: 60 }, status: 'ACTIVE', sortOrder: 0, options: [] },
      ],
      /**
       * Layouts (the spec's Layout): sections with ordered field placements. A placement can override required, read-only and the default.
       * A field that is not placed in a project's layout is hidden for that project, and its answer is kept.
       */
      layouts: [
        { id: 'l1', entityType: 'PROJECT', portalId: 'p1', name: 'Standard', description: 'Every project field in one section.', isDefault: true, active: true,
          sections: [{ id: 's1', name: 'Details', collapsible: false, fields: [{ apiName: 'cf_customer_tier', mandatory: null, readOnly: false, defaultValue: null }, { apiName: 'cf_budget', mandatory: null, readOnly: false, defaultValue: null }, { apiName: 'cf_go_live', mandatory: null, readOnly: false, defaultValue: null }, { apiName: 'cf_vip', mandatory: null, readOnly: false, defaultValue: null }, { apiName: 'cf_channels', mandatory: null, readOnly: false, defaultValue: null }, { apiName: 'cf_account_manager', mandatory: null, readOnly: false, defaultValue: null }, { apiName: 'cf_contract_no', mandatory: null, readOnly: false, defaultValue: null }] }] },
        { id: 'l2', entityType: 'PROJECT', portalId: 'p1', name: 'Marketing campaign', description: 'For campaigns: who it is for, and how it ships.', isDefault: false, active: true,
          sections: [
            { id: 's2', name: 'Client', collapsible: true, fields: [{ apiName: 'cf_customer_tier', mandatory: false, readOnly: false, defaultValue: null }, { apiName: 'cf_account_manager', mandatory: null, readOnly: true, defaultValue: null }] },
            { id: 's3', name: 'Delivery', collapsible: true, fields: [{ apiName: 'cf_channels', mandatory: true, readOnly: false, defaultValue: null }, { apiName: 'cf_go_live', mandatory: null, readOnly: false, defaultValue: null }, { apiName: 'cf_vip', mandatory: null, readOnly: false, defaultValue: null }] },
          ] },
        { id: 'l3', entityType: 'PROJECT', portalId: 'p2', name: 'Standard', description: '', isDefault: true, active: true,
          sections: [{ id: 's4', name: 'Details', collapsible: false, fields: [{ apiName: 'cf_region', mandatory: null, readOnly: false, defaultValue: null }] }] },
      ],
      sessionUserId: null,
      lastSignup: null,
    };
    return seedTasks(data, now);
  }

  let db = load();
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || seed(); } catch (e) { return seed(); } }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };
  const fail = (code, message, fields = null) => { throw Object.assign(new Error(message), { code, message, fields }); };
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

  /* ---------- custom fields (M1 Step 7) ---------- */
  const FIELD_TYPES = [
    ['TEXT', 'Text'], ['LONG_TEXT', 'Long text'], ['NUMBER', 'Whole number'], ['DECIMAL', 'Decimal'], ['DATE', 'Date'], ['CHECKBOX', 'Checkbox'],
    ['PICKLIST', 'Pick one'], ['MULTI_PICKLIST', 'Pick several'], ['USER', 'Person'],
  ];
  const UNIQUE_TYPES = ['TEXT', 'NUMBER', 'DECIMAL', 'DATE'];
  const MAX_FIELDS = 25;
  const MAX_DIGITS = 12, MAX_DECIMALS = 6;
  const fieldsOf = (portalId, entity = 'PROJECT') => db.customFields.filter((f) => f.portalId === portalId && f.entityType === entity);
  const liveFields = (portalId, entity = 'PROJECT') => fieldsOf(portalId, entity).filter((f) => f.status !== 'DELETED').sort((a, b) => a.sortOrder - b.sortOrder);
  const activeFields = (portalId, entity = 'PROJECT') => liveFields(portalId, entity).filter((f) => f.status === 'ACTIVE');
  const fieldView = (f) => ({ ...f, options: f.options.map((o) => ({ ...o })), config: { ...f.config } });
  const isEmpty = (v) => v == null || v === '' || (Array.isArray(v) && !v.length);
  const fieldById = (portalId, id) => db.customFields.find((f) => f.portalId === portalId && f.id === id && f.status !== 'DELETED') || fail('FIELD_NOT_FOUND', 'That custom field does not exist.');
  const snake = (label) => label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

  /** One problem message for one value, or null. `old` is the stored value, so a choice that was deactivated since stays valid. */
  function valueProblem(portalId, f, v, old) {
    const c = f.config || {};
    switch (f.type) {
      case 'TEXT': case 'LONG_TEXT': {
        if (typeof v !== 'string') return 'Enter text.';
        const max = c.maxLength ?? (f.type === 'TEXT' ? 255 : 5000);
        return v.length > max ? `Use ${max} characters or fewer.` : null;
      }
      case 'NUMBER': case 'DECIMAL': {
        const n = typeof v === 'number' ? v : Number(v);
        if (v === '' || !Number.isFinite(n)) return 'Enter a number.';
        if (f.type === 'NUMBER' && !Number.isInteger(n)) return 'Enter a whole number.';
        const [intPart, frac = ''] = String(Math.abs(n)).split('.');
        if (intPart.length > MAX_DIGITS) return `Use at most ${MAX_DIGITS} digits.`;
        const dec = Math.min(c.decimals ?? 2, MAX_DECIMALS);
        if (f.type === 'DECIMAL' && frac.length > dec) return `Use at most ${dec} decimal places.`;
        if (c.min != null && n < c.min) return `Must be at least ${c.min}.`;
        if (c.max != null && n > c.max) return `Must be at most ${c.max}.`;
        return null;
      }
      case 'DATE': return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? null : 'Enter a valid date.';
      case 'CHECKBOX': return typeof v === 'boolean' ? null : 'Use yes or no.';
      case 'PICKLIST': {
        const o = f.options.find((x) => x.id === v);
        return o && (o.active || old === v) ? null : 'Pick one of the listed choices.';
      }
      case 'MULTI_PICKLIST': {
        if (!Array.isArray(v)) return 'Pick from the listed choices.';
        if (new Set(v).size !== v.length) return 'A choice was picked twice.';
        const oldList = Array.isArray(old) ? old : [];
        if (v.some((id) => { const o = f.options.find((x) => x.id === id); return !o || (!o.active && !oldList.includes(id)); })) return 'Pick from the listed choices.';
        if (c.minSelect && v.length < c.minSelect) return `Pick at least ${c.minSelect}.`;
        if (c.maxSelect && v.length > c.maxSelect) return `Pick at most ${c.maxSelect}.`;
        return null;
      }
      case 'USER': { const m = membership(portalId, v); return m && m.status === 'ACTIVE' ? null : 'Pick an active person in this portal.'; }
      default: return 'Unknown field type.';
    }
  }
  const normalise = (f, v) => ((f.type === 'NUMBER' || f.type === 'DECIMAL') && typeof v === 'string' ? Number(v) : v);

  /* ---------- layouts ---------- */
  const MAX_LAYOUTS = 3;
  const layoutsOf = (portalId, entity = 'PROJECT') => db.layouts.filter((l) => l.portalId === portalId && (l.entityType || 'PROJECT') === entity);
  const defaultLayout = (portalId, entity = 'PROJECT') => layoutsOf(portalId, entity).find((l) => l.isDefault) || layoutsOf(portalId, entity)[0];
  const layoutById = (portalId, id) => db.layouts.find((l) => l.portalId === portalId && l.id === id) || fail('LAYOUT_NOT_FOUND', 'That layout does not exist.');
  /** A layout as the screens use it: only active fields, each with its effective required, read-only and default (a layout override beats the field). */
  function resolveLayout(portalId, l) {
    const byKey = Object.fromEntries(activeFields(portalId, l.entityType || 'PROJECT').map((f) => [f.apiName, f]));
    return { id: l.id, entityType: l.entityType || 'PROJECT', statuses: l.statuses ? statusList(l) : undefined, name: l.name, description: l.description, isDefault: l.isDefault, active: l.active,
      sections: l.sections.map((x) => ({ id: x.id, name: x.name, collapsible: x.collapsible, fields: x.fields.filter((pl) => byKey[pl.apiName]).map((pl) => {
        const f = byKey[pl.apiName];
        return { ...fieldView(f), mandatory: pl.mandatory ?? f.mandatory, readOnly: !!pl.readOnly, defaultValue: pl.defaultValue ?? f.defaultValue, fieldMandatory: f.mandatory, wide: pl.wide ?? null };
      }) })) };
  }
  const layoutFields = (portalId, l) => resolveLayout(portalId, l).sections.flatMap((x) => x.fields);
  const projectLayout = (portalId, p) => layoutsOf(portalId).find((l) => l.id === p.layoutId) || defaultLayout(portalId);
  const layoutUsage = (portalId, l) => db.projects.filter((p) => p.portalId === portalId && (l.entityType === 'TASK' ? projectTaskLayout(portalId, p) : projectLayout(portalId, p)).id === l.id).length;
  const needManage = (portalId) => requirePermission(portalId, 'CUSTOM_FIELDS_MANAGE');

  /**
   * The single gate for custom answers (CustomValueValidator): unknown keys are rejected, defaults fill a new record,
   * empty clears, mandatory and unique are enforced, and a read-only placement can't be changed. `layout` limits it to the fields placed in it.
   * Returns the full map to store, or fails with `fields` (apiName -> message).
   */
  function checkCustomValues(portalId, input, { existing = {}, creating, selfId = null, layout = null }) {
    const entity = layout?.entityType || 'PROJECT', noun = entity === 'TASK' ? 'task' : 'project';
    const defs = layout ? layoutFields(portalId, layout) : activeFields(portalId).map((f) => ({ ...f, readOnly: false })), problems = {}, out = { ...existing };
    const norm = (v) => JSON.stringify(isEmpty(v) ? null : v);
    const has = (k) => !!input && Object.prototype.hasOwnProperty.call(input, k);
    for (const k of Object.keys(input || {})) if (!defs.some((d) => d.apiName === k)) problems[k] = `This custom field is inactive, or not in this ${noun}'s layout.`;
    for (const f of defs) {
      let v = has(f.apiName) ? input[f.apiName] : undefined;
      if (f.readOnly && v !== undefined) { if (creating || norm(v) === norm(existing[f.apiName])) v = undefined; else { problems[f.apiName] = `${f.label} is read-only in this layout.`; continue; } }
      if (v === undefined) { if (creating && !isEmpty(f.defaultValue)) v = f.defaultValue; else continue; }
      if (isEmpty(v)) { delete out[f.apiName]; continue; }
      v = normalise(f, v);
      const msg = valueProblem(portalId, f, v, existing[f.apiName]);
      if (msg) problems[f.apiName] = msg; else out[f.apiName] = v;
    }
    for (const f of defs) {
      if (f.mandatory && !f.readOnly && isEmpty(out[f.apiName]) && !problems[f.apiName] && (creating || has(f.apiName))) problems[f.apiName] = `${f.label} is required.`;
      if (f.unique && !isEmpty(out[f.apiName]) && !problems[f.apiName]
        && (entity === 'TASK' ? db.tasks : db.projects).some((p) => p.portalId === portalId && p.id !== selfId && p.customValues?.[f.apiName] === out[f.apiName])) problems[f.apiName] = `${f.label} "${out[f.apiName]}" is already used by another ${noun}.`;
    }
    if (Object.keys(problems).length) fail('VALIDATION', Object.values(problems)[0], problems);
    return out; // answers of fields outside the layout stay in `existing` and are never touched by the form
  }
  const activeValues = (portalId, p) => Object.fromEntries(layoutFields(portalId, projectLayout(portalId, p)).filter((f) => !isEmpty(p.customValues?.[f.apiName])).map((f) => [f.apiName, p.customValues[f.apiName]]));
  const usageOf = (portalId, f) => (f.entityType === 'TASK' ? db.tasks : db.projects).filter((p) => p.portalId === portalId && !isEmpty(p.customValues?.[f.apiName])).length;

  function cleanConfig(type, c = {}) {
    const num = (x) => (x === '' || x == null || Number.isNaN(Number(x)) ? null : Number(x));
    const out = {};
    if (type === 'TEXT' || type === 'LONG_TEXT') { const m = num(c.maxLength); if (m != null) out.maxLength = Math.max(1, Math.min(m, type === 'TEXT' ? 255 : 5000)); }
    if (type === 'NUMBER' || type === 'DECIMAL') { const lo = num(c.min), hi = num(c.max); if (lo != null) out.min = lo; if (hi != null) out.max = hi; if (lo != null && hi != null && hi < lo) fail('VALIDATION', 'The maximum cannot be below the minimum.'); }
    if (type === 'DECIMAL') out.decimals = Math.max(0, Math.min(num(c.decimals) ?? 2, MAX_DECIMALS));
    if (type === 'MULTI_PICKLIST') { const lo = num(c.minSelect), hi = num(c.maxSelect); if (lo) out.minSelect = lo; if (hi) out.maxSelect = hi; if (lo && hi && hi < lo) fail('VALIDATION', 'The most you can pick cannot be below the fewest.'); }
    return out;
  }
  const PICK = ['PICKLIST', 'MULTI_PICKLIST'];
  function applyOptions(f, list) {
    const labels = new Set();
    const kept = list.map((o) => ({ id: o.id || 'o' + token(), label: String(o.label || '').trim(), active: o.active !== false }));
    for (const o of kept) {
      if (!o.label) fail('VALIDATION', 'A choice needs a label.');
      if (labels.has(o.label.toLowerCase())) fail('VALIDATION', `The choice "${o.label}" is listed twice.`);
      labels.add(o.label.toLowerCase());
    }
    if (!kept.some((o) => o.active)) fail('VALIDATION', 'Add at least one active choice.');
    for (const old of f.options) if (!kept.some((o) => o.id === old.id)) kept.push({ ...old, active: false }); // choices are deactivated, never deleted
    f.options = kept;
  }
  function checkDefault(portalId, f) {
    if (isEmpty(f.defaultValue)) { f.defaultValue = f.type === 'CHECKBOX' ? f.defaultValue === true : null; return; }
    f.defaultValue = normalise(f, f.defaultValue);
    const msg = valueProblem(portalId, f, f.defaultValue, null);
    if (msg) fail('VALIDATION', `Default value: ${msg}`, { defaultValue: msg });
    if (f.unique) fail('VALIDATION', 'A unique field cannot have a default value.', { defaultValue: 'A unique field cannot have a default value.' });
  }
  function checkFieldText(f) {
    if (!String(f.label || '').trim()) fail('VALIDATION', 'Name the field.', { label: 'Name the field.' });
    if (f.label.trim().length > 50) fail('VALIDATION', 'Use 50 characters or fewer.', { label: 'Use 50 characters or fewer.' });
    if ((f.description || '').length > 300) fail('VALIDATION', 'Use 300 characters or fewer.', { description: 'Use 300 characters or fewer.' });
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
    owner: { id: p.ownerId, name: userById(p.ownerId)?.fullName ?? 'Unknown' }, memberCount: projMembers(p.id).length, progress: (() => { const c = taskCounts(p); return c.total ? Math.round(c.closed * 100 / c.total) : 0; })(), taskCounts: taskCounts(p),
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

  /* ---------- tasks (M1 Step 6) ---------- */
  const TASK_PRIORITIES = [['NONE', 'None'], ['LOW', 'Low'], ['MEDIUM', 'Medium'], ['HIGH', 'High'], ['CRITICAL', 'Critical']];
  const PRIORITY_LABEL = Object.fromEntries(TASK_PRIORITIES);
  const MAX_DEPTH = 5, MAX_TAGS = 20, TAG_LENGTH = 30, MAX_STATUSES = 12, TITLE_MAX = 200, LIST_NAME_MAX = 100;
  const statusList = (l) => [...(l.statuses || [])].sort((a, b) => a.sortOrder - b.sortOrder).map((x) => ({ ...x }));
  const projectTaskLayout = (portalId, p) => layoutsOf(portalId, 'TASK').find((l) => l.id === p.taskLayoutId) || defaultLayout(portalId, 'TASK');
  const isoToday = () => { const d = new Date(), pad = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const taskById = (portalId, id) => db.tasks.find((t) => t.portalId === portalId && t.id === id);
  const kids = (t, { trashed = false } = {}) => db.tasks.filter((x) => x.parentId === t.id && !!x.deletedAt === trashed);
  const descendants = (t) => kids(t).flatMap((k) => [k, ...descendants(k)]);
  const depthOf = (t) => { let d = 1, cur = t; while (cur.parentId) { cur = db.tasks.find((x) => x.id === cur.parentId); d++; } return d; };
  const personName = (id) => userById(id)?.fullName ?? 'Unknown';
  const statusOf = (layout, t) => (layout.statuses || []).find((x) => x.id === t.statusId);
  const taskCounts = (p) => {
    const lay = projectTaskLayout(p.portalId, p), today = isoToday(), ts = db.tasks.filter((t) => t.projectId === p.id && !t.deletedAt);
    const closed = ts.filter((t) => statusOf(lay, t)?.type === 'CLOSED').length;
    return { total: ts.length, closed, open: ts.length - closed, overdue: ts.filter((t) => statusOf(lay, t)?.type !== 'CLOSED' && t.dueDate && t.dueDate < today).length };
  };
  /** Task access: everyone who can see the project can read; Admins and project members can work (create, edit, comment), per the profile's TASKS_* permission. */
  function needTaskProject(portalId, projectId) {
    const { user, m } = requirePermission(portalId, 'TASKS_VIEW');
    const p = projectById(portalId, projectId);
    if (!p || p.deletedAt || !canSee(p, user, m)) fail('PROJECT_NOT_FOUND', 'That project does not exist, or you cannot see it.');
    return { p, user, m };
  }
  const may = (m, perm) => profileOf(m.profile).permissions.includes(perm);
  const canWork = (p, user, m) => m.profile === 'ADMIN' || !!projectRole(p.id, user.id);
  const needTask = (portalId, id, { trashed = false, any = false } = {}) => {
    const { user, m } = requirePermission(portalId, 'TASKS_VIEW');
    const t = taskById(portalId, id), p = t && projectById(portalId, t.projectId);
    if (!t || !p || p.deletedAt || !canSee(p, user, m) || (!any && !!t.deletedAt !== trashed)) fail('TASK_NOT_FOUND', 'That task does not exist, or you cannot see it.');
    return { t, p, user, m, layout: projectTaskLayout(portalId, p) };
  };
  const needTaskEdit = (portalId, id, perm = 'TASKS_EDIT') => {
    const ctx = needTask(portalId, id);
    if (!may(ctx.m, perm) || !canWork(ctx.p, ctx.user, ctx.m)) fail('FORBIDDEN', 'Your profile or project role does not allow changing this task.');
    return ctx;
  };
  function logTask(t, action, { field = null, from = null, to = null, text = null } = {}) {
    db.taskActivity.push({ id: 'ta' + token(), portalId: t.portalId, taskId: t.id, at: Date.now(), actorId: db.sessionUserId, action, field, from, to, text });
  }
  const follow = (t, userId) => { if (userId && !t.followerIds.includes(userId)) t.followerIds.push(userId); };
  function ensureGeneralList(portalId, projectId) {
    if (!db.taskLists.some((l) => l.projectId === projectId && l.isDefault)) db.taskLists.push({ id: 'tl' + token(), portalId, projectId, name: 'General', isDefault: true, flag: 'INTERNAL', archived: false, sortOrder: -1 });
  }
  const listsOf = (projectId) => db.taskLists.filter((l) => l.projectId === projectId).sort((a, b) => a.sortOrder - b.sortOrder);
  function cleanTags(tags) {
    const out = [];
    for (const raw of tags || []) {
      const t = String(raw).trim();
      if (!t) continue;
      if (t.length > TAG_LENGTH) fail('VALIDATION', `A tag can have at most ${TAG_LENGTH} characters.`, { tags: `A tag can have at most ${TAG_LENGTH} characters.` });
      if (!out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
    }
    if (out.length > MAX_TAGS) fail('VALIDATION', `A task can have at most ${MAX_TAGS} tags.`, { tags: `A task can have at most ${MAX_TAGS} tags.` });
    return out;
  }
  function checkPeople(portalId, ids, what) {
    for (const id of ids) { const mm = membership(portalId, id); if (!mm || mm.status !== 'ACTIVE') fail('VALIDATION', `Pick active people in this portal as ${what}.`, { [what]: `Pick active people in this portal.` }); }
    return [...new Set(ids)];
  }
  function checkTaskFields(portalId, f, cur = {}) {
    const has = (k) => Object.prototype.hasOwnProperty.call(f, k), out = {};
    if (has('title')) { const t = String(f.title || '').trim(); if (!t) fail('VALIDATION', 'Give the task a title.', { title: 'Give the task a title.' }); if (t.length > TITLE_MAX) fail('VALIDATION', `Use ${TITLE_MAX} characters or fewer.`, { title: `Use ${TITLE_MAX} characters or fewer.` }); out.title = t; }
    if (has('description')) { const d = String(f.description || '').trim(); if (d.length > 10000) fail('VALIDATION', 'Use 10000 characters or fewer.', { description: 'Use 10000 characters or fewer.' }); out.description = d; }
    if (has('priority')) { if (!PRIORITY_LABEL[f.priority]) fail('VALIDATION', 'Pick a priority.', { priority: 'Pick a priority.' }); out.priority = f.priority; }
    const start = has('startDate') ? (f.startDate || null) : cur.startDate ?? null, due = has('dueDate') ? (f.dueDate || null) : cur.dueDate ?? null;
    for (const [k, v] of [['startDate', start], ['dueDate', due]]) if (v && !(/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)))) fail('VALIDATION', 'Enter a valid date.', { [k]: 'Enter a valid date.' });
    if (start && due && due < start) fail('VALIDATION', "The due date can't be before the start date.", { dueDate: "The due date can't be before the start date." });
    if (has('startDate')) out.startDate = start; if (has('dueDate')) out.dueDate = due;
    if (has('workHours')) {
      if (f.workHours === null || f.workHours === '') out.workHours = null;
      else { const h = Number(f.workHours); if (!Number.isFinite(h) || h < 0) fail('VALIDATION', 'Work hours must be zero or more.', { workHours: 'Work hours must be zero or more.' }); if (h > 99999) fail('VALIDATION', 'Use 99999 hours or fewer.', { workHours: 'Use 99999 hours or fewer.' }); out.workHours = Math.round(h * 100) / 100; }
    }
    if (has('completion')) {
      const c = Number(f.completion);
      if (f.completion === null || f.completion === '' || !Number.isInteger(c) || c < 0 || c > 100) fail('VALIDATION', 'Completion is a whole number from 0 to 100.', { completion: 'Completion is a whole number from 0 to 100.' });
      out.completion = c;
    }
    if (has('ownerIds')) out.ownerIds = checkPeople(portalId, f.ownerIds || [], 'owners');
    if (has('tags')) out.tags = cleanTags(f.tags);
    return out;
  }
  const taskRow = (t, layout) => {
    const sts = statusOf(layout, t) || { id: t.statusId, name: 'Unknown', type: 'OPEN', color: 'gray' }, ks = kids(t);
    return { id: t.id, key: t.key, seq: t.seq, title: t.title, listId: t.listId, parentId: t.parentId, status: { ...sts }, statusId: t.statusId, priority: t.priority,
      ownerIds: [...t.ownerIds], owners: t.ownerIds.map((id) => ({ id, name: personName(id) })), startDate: t.startDate, dueDate: t.dueDate, completion: t.completion, workHours: t.workHours,
      subtaskCount: ks.length, subtasksDone: ks.filter((k) => statusOf(layout, k)?.type === 'CLOSED').length, tags: [...t.tags], closed: sts.type === 'CLOSED',
      overdue: sts.type !== 'CLOSED' && !!t.dueDate && t.dueDate < isoToday(), deletedAt: t.deletedAt };
  };
  /** Layout statuses: TSK-BR-04's set (CUS rules: one default, at least one Open and one Closed, unique names, in-use statuses stay). */
  const taskLayoutById = (portalId, id) => { const l = layoutById(portalId, id); if (l.entityType !== 'TASK') fail('LAYOUT_NOT_FOUND', 'That layout does not exist.'); return l; };
  const statusUsage = (portalId, st) => db.tasks.filter((t) => t.portalId === portalId && t.statusId === st.id).length;
  function checkStatusSet(l) {
    const list = l.statuses;
    if (!list.some((x) => x.type === 'OPEN')) fail('VALIDATION', 'A layout needs at least one Open status.');
    if (!list.some((x) => x.type === 'CLOSED')) fail('VALIDATION', 'A layout needs at least one Closed status.');
    const def = list.filter((x) => x.isDefault);
    if (def.length !== 1 || def[0].type !== 'OPEN') fail('VALIDATION', 'The default status must be an Open status.');
  }
  function statusName(l, name, selfId) {
    const n = String(name || '').trim();
    if (!n) fail('VALIDATION', 'Name the status.', { name: 'Name the status.' });
    if (n.length > 30) fail('VALIDATION', 'Use 30 characters or fewer.', { name: 'Use 30 characters or fewer.' });
    if (l.statuses.some((x) => x.id !== selfId && x.name.toLowerCase() === n.toLowerCase())) fail('VALIDATION', 'A status with this name already exists.', { name: 'A status with this name already exists.' });
    return n;
  }

  return {
    PROFILES, profileOf, PROJECT_STATUSES, TASK_PRIORITIES, STATUS_COLORS, MAX_STATUSES, MAX_DEPTH, MAX_TAGS, TAG_LENGTH, TITLE_MAX, FIELD_TYPES, UNIQUE_TYPES, MAX_FIELDS, MAX_LAYOUTS,
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
      db.layouts.push({ id: 'l' + token(), entityType: 'PROJECT', portalId: portal.id, name: 'Standard', description: '', isDefault: true, active: true, sections: [{ id: 's' + token(), name: 'Details', collapsible: false, fields: [] }] },
        { id: 'l' + token(), entityType: 'TASK', portalId: portal.id, name: 'Standard', description: 'Open, In Progress and Closed.', isDefault: true, active: true, statuses: defaultStatuses(), sections: [{ id: 's' + token(), name: 'Details', collapsible: false, fields: [] }] });
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
      const layout = resolveLayout(portalId, projectLayout(portalId, p));
      // answers of active fields that this layout doesn't show are kept; the edit form needs them if the layout is switched
      const hiddenValues = Object.fromEntries(activeFields(portalId).filter((f) => !isEmpty(p.customValues?.[f.apiName]) && !(f.apiName in activeValues(portalId, p))).map((f) => [f.apiName, p.customValues[f.apiName]]));
      return { ...enrich(p, user, m), members, activity, customValues: activeValues(portalId, p), hiddenValues, layoutId: layout.id, layout, taskLayoutId: projectTaskLayout(portalId, p).id };
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
      const layout = f.layoutId ? layoutById(portalId, f.layoutId) : defaultLayout(portalId);
      if (!layout.active) fail('VALIDATION', 'That layout is inactive.');
      const customValues = checkCustomValues(portalId, f.customValues, { creating: true, layout });
      const p = { id: 'pr' + token(), portalId, key: f.key, name: f.name.trim(), description: (f.description || '').trim(), ownerId, status: 'Active', startDate: f.startDate || null, endDate: f.endDate || null, visibility: f.visibility || 'PRIVATE', createdAt: Date.now(), deletedAt: null, deletedBy: null, customValues, layoutId: layout.id };
      db.projects.push(p);
      addProjMember(p.id, ownerId, 'Manager'); // PRJ-BR-05: the owner is always a Manager member
      record(portalId, 'PROJECT_CREATED', { target: `${p.key} · ${p.name}`, detail: 'Created project', projectId: p.id });
      return { id: p.id };
    }),
    /**
     * Partial by presence, like PATCH /api/work/projects/{id}: only the properties in `f` change; a property left out stays,
     * and a null clears a date, the description or an answer. The complete Edit form sends them all, a single-field edit one.
     */
    updateProject: (portalId, id, f) => call(() => {
      const { p, user, m } = needProject(portalId, id);
      if (!canEditProject(p, user, m)) fail('FORBIDDEN', 'Your profile or project role does not allow editing this project.');
      const has = (k) => Object.prototype.hasOwnProperty.call(f, k);
      let name = p.name;
      if (has('name')) { name = String(f.name || '').trim(); if (!name) fail('VALIDATION', 'Name the project.'); if (name.length > 100) fail('VALIDATION', 'Use 100 characters or fewer.'); }
      let description = p.description;
      if (has('description')) { description = String(f.description || '').trim(); if (description.length > 5000) fail('VALIDATION', 'Use 5000 characters or fewer.'); }
      let visibility = p.visibility;
      if (has('visibility')) { if (!f.visibility) fail('VALIDATION', 'Choose who can see the project.'); visibility = f.visibility; }
      const startDate = has('startDate') ? (f.startDate || null) : p.startDate, endDate = has('endDate') ? (f.endDate || null) : p.endDate;
      if (startDate && endDate && endDate < startDate) fail('VALIDATION', "The end date can't be before the start date.");
      const ownerId = has('ownerId') && f.ownerId ? f.ownerId : p.ownerId;
      if (ownerId !== p.ownerId && !membership(portalId, ownerId)) fail('VALIDATION', 'The owner must be a member of this portal.');
      const oldLayout = projectLayout(portalId, p);
      let layout = oldLayout;
      if (f.layoutId && f.layoutId !== oldLayout.id) {
        layout = layoutById(portalId, f.layoutId);
        if (!layout.active) fail('VALIDATION', 'That layout is inactive.');
      }
      let nextValues = null;
      if (has('customValues') && f.customValues) nextValues = checkCustomValues(portalId, f.customValues, { existing: p.customValues || {}, creating: false, selfId: p.id, layout });
      // everything is valid: apply it
      const changes = [];
      const set = (field, value, label) => { if ((p[field] || null) !== (value || null)) { changes.push(label); p[field] = value || (field === 'description' ? '' : null); } };
      set('name', name, 'name'); set('description', description, 'description'); set('startDate', startDate, 'start date'); set('endDate', endDate, 'end date'); set('visibility', visibility, 'visibility');
      if (ownerId !== p.ownerId) {
        addProjMember(p.id, ownerId, 'Manager'); db.projectMembers.find((x) => x.projectId === p.id && x.userId === ownerId).role = 'Manager'; // the old owner stays a member (PRJ-BR-05)
        p.ownerId = ownerId; changes.push('owner');
      }
      if (nextValues) {
        for (const d of layoutFields(portalId, layout)) if (JSON.stringify(nextValues[d.apiName] ?? null) !== JSON.stringify((p.customValues || {})[d.apiName] ?? null)) changes.push(d.label.toLowerCase());
        p.customValues = nextValues;
      }
      if (layout.id !== oldLayout.id) { p.layoutId = layout.id; changes.push(`layout (${oldLayout.name} → ${layout.name})`); }
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
    /** Click-to-edit on the overview: changes one custom answer (null clears it). Same rules and rights as the full edit form. */
    setProjectCustomValue: (portalId, id, apiName, value) => call(() => {
      const { p, user, m } = needProject(portalId, id);
      if (!canEditProject(p, user, m)) fail('FORBIDDEN', 'Your profile or project role does not allow editing this project.');
      const layout = projectLayout(portalId, p);
      const def = layoutFields(portalId, layout).find((d) => d.apiName === apiName);
      if (!def) fail('VALIDATION', "That field is inactive, or not in this project's layout.", { [apiName]: "That field is not in this project's layout." });
      const next = checkCustomValues(portalId, { [apiName]: value }, { existing: p.customValues || {}, creating: false, selfId: p.id, layout });
      if (JSON.stringify(next[apiName] ?? null) === JSON.stringify((p.customValues || {})[apiName] ?? null)) return;
      p.customValues = next;
      record(portalId, 'PROJECT_UPDATED', { target: `${p.key} · ${p.name}`, detail: `Changed ${def.label.toLowerCase()}`, projectId: p.id });
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

    /* ----- custom fields ----- */
    /** Active fields in form order: what the project form and overview show (CUSTOM_FIELDS_VIEW). */
    customFields: (portalId, entity = 'PROJECT') => call(() => { requirePermission(portalId, 'CUSTOM_FIELDS_VIEW'); return activeFields(portalId, entity).map(fieldView); }),
    /** Active and inactive, for the admin screen (CUSTOM_FIELDS_MANAGE or view, with usage). */
    customFieldsAdmin: (portalId, entity = 'PROJECT') => call(() => { requirePermission(portalId, 'CUSTOM_FIELDS_VIEW'); return liveFields(portalId, entity).map((f) => ({ ...fieldView(f), usage: usageOf(portalId, f) })); }),
    customField: (portalId, id) => call(() => { requirePermission(portalId, 'CUSTOM_FIELDS_VIEW'); const f = fieldById(portalId, id); return { ...fieldView(f), usage: usageOf(portalId, f) }; }),
    createCustomField: (portalId, f) => call(() => {
      needManage(portalId);
      const entity = f.entityType === 'TASK' ? 'TASK' : 'PROJECT';
      checkFieldText(f);
      if (!FIELD_TYPES.some(([t]) => t === f.type)) fail('VALIDATION', 'Pick a field type.', { type: 'Pick a field type.' });
      if (liveFields(portalId, entity).length >= MAX_FIELDS) fail('LIMIT', `A module can have at most ${MAX_FIELDS} custom fields. Delete one you no longer use.`);
      const base = 'cf_' + (snake(f.label) || 'field');
      const taken = new Set(fieldsOf(portalId, entity).map((x) => x.apiName)); // DELETED rows count: a key is never reused
      let apiName = base, n = 2;
      while (taken.has(apiName)) apiName = `${base}_${n++}`;
      const unique = !!f.unique && UNIQUE_TYPES.includes(f.type);
      const def = { id: 'f' + token(), portalId, entityType: entity, apiName, label: f.label.trim(), description: (f.description || '').trim(), type: f.type, mandatory: !!f.mandatory, unique,
        sensitive: !!f.sensitive, defaultValue: f.defaultValue ?? null, config: cleanConfig(f.type, f.config), status: 'ACTIVE', sortOrder: liveFields(portalId, entity).length, options: [] };
      if (PICK.includes(f.type)) applyOptions(def, f.options || []);
      checkDefault(portalId, def);
      db.customFields.push(def);
      const home = defaultLayout(portalId, entity); // a new field lands in the default layout's last section; drag it elsewhere in the layout editor
      home.sections[home.sections.length - 1].fields.push({ apiName, mandatory: null, readOnly: false, defaultValue: null });
      return { id: def.id };
    }),
    /** The type, the key and "unique" can't change after creation. */
    updateCustomField: (portalId, id, f) => call(() => {
      needManage(portalId);
      const def = fieldById(portalId, id);
      checkFieldText(f);
      def.label = f.label.trim(); def.description = (f.description || '').trim(); def.mandatory = !!f.mandatory; def.sensitive = !!f.sensitive;
      def.config = cleanConfig(def.type, f.config);
      if (PICK.includes(def.type)) applyOptions(def, f.options || []);
      def.defaultValue = f.defaultValue ?? null;
      checkDefault(portalId, def);
    }),
    deactivateCustomField: (portalId, id) => call(() => { needManage(portalId); fieldById(portalId, id).status = 'INACTIVE'; }),
    activateCustomField: (portalId, id) => call(() => {
      needManage(portalId);
      const f = fieldById(portalId, id);
      if (activeFields(portalId, f.entityType).length >= MAX_FIELDS) fail('LIMIT', `A module can have at most ${MAX_FIELDS} active custom fields.`);
      f.status = 'ACTIVE';
    }),
    /** How many projects hold an answer: the impact shown before a delete. */
    customFieldUsage: (portalId, id) => call(() => { needManage(portalId); return { count: usageOf(portalId, fieldById(portalId, id)) }; }),
    deleteCustomField: (portalId, id) => call(() => {
      needManage(portalId);
      const f = fieldById(portalId, id);
      for (const p of (f.entityType === 'TASK' ? db.tasks : db.projects)) if (p.portalId === portalId && p.customValues) delete p.customValues[f.apiName]; // answers are removed; the row stays so the key is never reused
      f.status = 'DELETED';
      for (const l of layoutsOf(portalId, f.entityType)) for (const x of l.sections) x.fields = x.fields.filter((pl) => pl.apiName !== f.apiName);
      liveFields(portalId, f.entityType).forEach((x, i) => { x.sortOrder = i; });
    }),
    moveCustomField: (portalId, id, dir) => call(() => {
      needManage(portalId);
      const list = liveFields(portalId, fieldById(portalId, id).entityType), i = list.findIndex((f) => f.id === id), j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      list.forEach((f, k) => { f.sortOrder = k; });
    }),

    /* ----- layouts ----- */
    /** Switch one project to another layout (needs edit rights on the project). Answers for fields the new layout doesn't show are kept. */
    setProjectLayout: (portalId, id, layoutId) => call(() => {
      const { p, user, m } = needProject(portalId, id);
      if (!canEditProject(p, user, m)) fail('FORBIDDEN', 'Your profile or project role does not allow editing this project.');
      const layout = layoutById(portalId, layoutId), old = projectLayout(portalId, p);
      if (!layout.active) fail('VALIDATION', 'That layout is inactive.');
      if (old.id === layout.id) return;
      p.layoutId = layout.id;
      record(portalId, 'PROJECT_UPDATED', { target: `${p.key} · ${p.name}`, detail: `Changed layout (${old.name} → ${layout.name})`, projectId: p.id });
    }),
    /** Active layouts, resolved (only active fields, effective flags): what the project form offers. */
    layoutsResolved: (portalId, entity = 'PROJECT') => call(() => { requirePermission(portalId, 'CUSTOM_FIELDS_VIEW'); return layoutsOf(portalId, entity).filter((l) => l.active).map((l) => resolveLayout(portalId, l)); }),
    /** All layouts with counts, for the admin list. */
    layoutsAdmin: (portalId, entity = 'PROJECT') => call(() => {
      requirePermission(portalId, 'CUSTOM_FIELDS_VIEW');
      return layoutsOf(portalId, entity).map((l) => ({ id: l.id, name: l.name, description: l.description, isDefault: l.isDefault, active: l.active,
        sectionCount: l.sections.length, fieldCount: layoutFields(portalId, l).length, usage: layoutUsage(portalId, l) }));
    }),
    /** One layout for the editor: its raw sections and placements, plus every field that could be placed. */
    layout: (portalId, id) => call(() => {
      requirePermission(portalId, 'CUSTOM_FIELDS_VIEW');
      const l = layoutById(portalId, id);
      return { id: l.id, name: l.name, description: l.description, isDefault: l.isDefault, active: l.active, usage: layoutUsage(portalId, l),
        sections: l.sections.map((x) => ({ id: x.id, name: x.name, collapsible: x.collapsible, fields: x.fields.map((pl) => ({ ...pl })) })),
        entityType: l.entityType || 'PROJECT', fields: liveFields(portalId, l.entityType || 'PROJECT').map(fieldView) };
    }),
    /** A blank layout, or a copy of another one (CUS-US-25). */
    createLayout: (portalId, { name, description, cloneFrom, entityType }) => call(() => {
      needManage(portalId);
      const entity = entityType === 'TASK' ? 'TASK' : 'PROJECT';
      const label = String(name || '').trim();
      if (!label) fail('VALIDATION', 'Name the layout.', { name: 'Name the layout.' });
      if (label.length > 50) fail('VALIDATION', 'Use 50 characters or fewer.', { name: 'Use 50 characters or fewer.' });
      if (layoutsOf(portalId, entity).length >= MAX_LAYOUTS) fail('LIMIT', `A module can have at most ${MAX_LAYOUTS} layouts. Deactivate one you no longer use, or edit it instead.`);
      if (layoutsOf(portalId, entity).some((l) => l.name.toLowerCase() === label.toLowerCase())) fail('VALIDATION', 'A layout with this name already exists.', { name: 'A layout with this name already exists.' });
      const src = cloneFrom ? layoutById(portalId, cloneFrom) : null;
      const l = { id: 'l' + token(), portalId, entityType: entity, name: label, description: (description || '').trim(), isDefault: false, active: true,
        ...(entity === 'TASK' ? { statuses: (src?.statuses || defaultStatuses()).map((x) => ({ ...x, id: 'st' + token() })) } : {}),
        sections: src ? src.sections.map((x) => ({ id: 's' + token(), name: x.name, collapsible: x.collapsible, fields: x.fields.map((pl) => ({ ...pl })) })) : [{ id: 's' + token(), name: 'Details', collapsible: false, fields: [] }] };
      db.layouts.push(l);
      return { id: l.id };
    }),
    updateLayout: (portalId, id, f) => call(() => {
      needManage(portalId);
      const l = layoutById(portalId, id), label = String(f.name || '').trim();
      if (!label) fail('VALIDATION', 'Name the layout.', { name: 'Name the layout.' });
      if (label.length > 50) fail('VALIDATION', 'Use 50 characters or fewer.', { name: 'Use 50 characters or fewer.' });
      if (layoutsOf(portalId, l.entityType || 'PROJECT').some((x) => x.id !== l.id && x.name.toLowerCase() === label.toLowerCase())) fail('VALIDATION', 'A layout with this name already exists.', { name: 'A layout with this name already exists.' });
      if (!f.sections?.length) fail('VALIDATION', 'A layout needs at least one section.', { sections: 'A layout needs at least one section.' });
      const names = new Set(), placed = new Set(), known = new Set(liveFields(portalId, l.entityType || 'PROJECT').map((x) => x.apiName));
      for (const x of f.sections) {
        const n = String(x.name || '').trim();
        if (!n) fail('VALIDATION', 'Every section needs a name.', { sections: 'Every section needs a name.' });
        if (names.has(n.toLowerCase())) fail('VALIDATION', `Two sections are called "${n}".`, { sections: `Two sections are called "${n}".` });
        names.add(n.toLowerCase());
        for (const pl of x.fields || []) {
          if (!known.has(pl.apiName)) fail('VALIDATION', 'A placed field does not exist any more.');
          if (placed.has(pl.apiName)) fail('VALIDATION', 'A field can be placed only once in a layout.');
          placed.add(pl.apiName);
        }
      }
      l.name = label; l.description = (f.description || '').trim();
      l.sections = f.sections.map((x) => ({ id: x.id || 's' + token(), name: x.name.trim(), collapsible: !!x.collapsible,
        fields: (x.fields || []).map((pl) => ({ apiName: pl.apiName, mandatory: pl.mandatory ?? null, readOnly: !!pl.readOnly, defaultValue: isEmpty(pl.defaultValue) ? null : pl.defaultValue, wide: typeof pl.wide === 'boolean' ? pl.wide : null })) }));
    }),
    setDefaultLayout: (portalId, id) => call(() => {
      needManage(portalId);
      const l = layoutById(portalId, id);
      if (!l.active) fail('VALIDATION', 'Activate the layout first.');
      layoutsOf(portalId, l.entityType || 'PROJECT').forEach((x) => { x.isDefault = x.id === l.id; });
    }),
    deactivateLayout: (portalId, id) => call(() => {
      needManage(portalId);
      const l = layoutById(portalId, id);
      if (l.isDefault) fail('VALIDATION', 'Make another layout the default first.');
      l.active = false; // projects already on it keep it
    }),
    activateLayout: (portalId, id) => call(() => { needManage(portalId); layoutById(portalId, id).active = true; }),


    /* ----- layout statuses (TASK layouts only; owned by the customization engine) ----- */
    layoutStatuses: (portalId, layoutId) => call(() => {
      requirePermission(portalId, 'CUSTOM_FIELDS_VIEW');
      return statusList(taskLayoutById(portalId, layoutId)).map((x) => ({ ...x, usage: statusUsage(portalId, x) }));
    }),
    addLayoutStatus: (portalId, layoutId, f) => call(() => {
      needManage(portalId);
      const l = taskLayoutById(portalId, layoutId);
      if (l.statuses.length >= MAX_STATUSES) fail('LIMIT', `A layout can have at most ${MAX_STATUSES} statuses.`);
      const name = statusName(l, f.name), type = f.type === 'CLOSED' ? 'CLOSED' : 'OPEN';
      const color = STATUS_COLORS.some(([k]) => k === f.color) ? f.color : type === 'CLOSED' ? 'green' : 'gray';
      const st = { id: 'st' + token(), name, type, color, isDefault: false, sortOrder: l.statuses.length };
      l.statuses.push(st);
      return { id: st.id };
    }),
    /** Partial by presence: name, type, color, isDefault (true makes it the one default). */
    updateLayoutStatus: (portalId, layoutId, id, f) => call(() => {
      needManage(portalId);
      const l = taskLayoutById(portalId, layoutId), st = l.statuses.find((x) => x.id === id);
      if (!st) fail('STATUS_NOT_FOUND', 'That status does not exist.');
      const has = (k) => Object.prototype.hasOwnProperty.call(f, k), before = JSON.stringify(l.statuses);
      try {
        if (has('name')) st.name = statusName(l, f.name, st.id);
        if (has('color')) { if (!STATUS_COLORS.some(([k]) => k === f.color)) fail('VALIDATION', 'Pick one of the colours.'); st.color = f.color; }
        if (has('type')) { if (!['OPEN', 'CLOSED'].includes(f.type)) fail('VALIDATION', 'A status is Open or Closed.'); if (st.isDefault && f.type === 'CLOSED') fail('VALIDATION', 'The default status must be an Open status. Make another one the default first.'); st.type = f.type; }
        if (has('isDefault') && f.isDefault === true) { if (st.type !== 'OPEN') fail('VALIDATION', 'The default status must be an Open status.'); l.statuses.forEach((x) => { x.isDefault = x.id === st.id; }); }
        if (has('isDefault') && f.isDefault === false && st.isDefault) fail('VALIDATION', 'Pick another status as the default instead.');
        checkStatusSet(l);
      } catch (e) { l.statuses = JSON.parse(before); throw e; }
    }),
    deleteLayoutStatus: (portalId, layoutId, id) => call(() => {
      needManage(portalId);
      const l = taskLayoutById(portalId, layoutId), st = l.statuses.find((x) => x.id === id);
      if (!st) fail('STATUS_NOT_FOUND', 'That status does not exist.');
      const used = statusUsage(portalId, st);
      if (used) fail('STATUS_IN_USE', `${used} task${used === 1 ? ' uses' : 's use'} "${st.name}". Move ${used === 1 ? 'it' : 'them'} to another status first.`);
      if (st.isDefault) fail('VALIDATION', 'Make another status the default before deleting this one.');
      const rest = l.statuses.filter((x) => x.id !== id);
      if (!rest.some((x) => x.type === st.type)) fail('VALIDATION', `A layout needs at least one ${st.type === 'OPEN' ? 'Open' : 'Closed'} status.`);
      l.statuses = rest; l.statuses.sort((a, b) => a.sortOrder - b.sortOrder).forEach((x, i) => { x.sortOrder = i; });
    }),
    orderLayoutStatuses: (portalId, layoutId, ids) => call(() => {
      needManage(portalId);
      const l = taskLayoutById(portalId, layoutId);
      if (ids.length !== l.statuses.length || !l.statuses.every((x) => ids.includes(x.id))) fail('VALIDATION', 'The order must list every status once.');
      ids.forEach((sid, i) => { l.statuses.find((x) => x.id === sid).sortOrder = i; });
    }),

    /* ----- project: which task layout it uses ----- */
    /** Per-status task counts of a project, so project settings can show where tasks land when the layout changes. */
    taskStatusCounts: (portalId, projectId) => call(() => {
      const { p } = needTaskProject(portalId, projectId), lay = projectTaskLayout(portalId, p);
      return statusList(lay).map((x) => ({ ...x, count: db.tasks.filter((t) => t.projectId === p.id && !t.deletedAt && t.statusId === x.id).length }));
    }),
    /** Switch the project's task layout. Tasks keep their status when the new layout has one with the same name (any case), else they go to the default Open status (Closed ones to the first Closed). */
    setProjectTaskLayout: (portalId, projectId, layoutId) => call(() => {
      const { p, user, m } = needProject(portalId, projectId);
      if (!canEditProject(p, user, m)) fail('FORBIDDEN', 'Your profile or project role does not allow editing this project.');
      const next = taskLayoutById(portalId, layoutId), old = projectTaskLayout(portalId, p);
      if (!next.active) fail('VALIDATION', 'That layout is inactive.');
      if (next.id === old.id) return { moved: 0 };
      let moved = 0;
      for (const t of db.tasks) {
        if (t.projectId !== p.id) continue;
        const was = statusOf(old, t), match = next.statuses.find((x) => x.name.toLowerCase() === (was?.name || '').toLowerCase());
        const target = match || (was?.type === 'CLOSED' ? next.statuses.find((x) => x.type === 'CLOSED') : next.statuses.find((x) => x.isDefault));
        if (target.id !== t.statusId) {
          const wasClosed = was?.type === 'CLOSED';
          t.statusId = target.id; moved++;
          if (target.type === 'CLOSED' && !wasClosed) { t.prevCompletion = t.completion; t.completion = 100; t.closedAt = Date.now(); }
          if (target.type === 'OPEN' && wasClosed) { t.completion = t.prevCompletion ?? 0; t.closedAt = null; }
          logTask(t, 'STATUS', { field: 'Status', from: was?.name ?? '?', to: target.name });
        }
      }
      p.taskLayoutId = next.id;
      record(portalId, 'PROJECT_UPDATED', { target: `${p.key} · ${p.name}`, detail: `Changed task layout (${old.name} → ${next.name})`, projectId: p.id });
      return { moved };
    }),

    /* ----- task lists ----- */
    taskLists: (portalId, projectId) => call(() => {
      const { p, user, m } = needTaskProject(portalId, projectId);
      ensureGeneralList(portalId, p.id);
      const lay = projectTaskLayout(portalId, p);
      return listsOf(p.id).map((l) => { const ts = db.tasks.filter((t) => t.listId === l.id && !t.deletedAt); return { id: l.id, name: l.name, isDefault: l.isDefault, flag: l.flag, archived: l.archived, taskCount: ts.length, openCount: ts.filter((t) => statusOf(lay, t)?.type !== 'CLOSED').length }; });
    }),
    createTaskList: (portalId, projectId, f) => call(() => {
      const { p, user, m } = needTaskProject(portalId, projectId);
      if (!canEditProject(p, user, m) || !may(m, 'TASKS_CREATE')) fail('FORBIDDEN', 'Only a project Manager or an Admin can manage task lists.');
      ensureGeneralList(portalId, p.id);
      const name = String(f.name || '').trim();
      if (!name) fail('VALIDATION', 'Name the list.', { name: 'Name the list.' });
      if (name.length > LIST_NAME_MAX) fail('VALIDATION', `Use ${LIST_NAME_MAX} characters or fewer.`, { name: `Use ${LIST_NAME_MAX} characters or fewer.` });
      if (listsOf(p.id).some((l) => l.name.toLowerCase() === name.toLowerCase())) fail('VALIDATION', 'A list with this name already exists in this project.', { name: 'A list with this name already exists in this project.' });
      const l = { id: 'tl' + token(), portalId, projectId: p.id, name, isDefault: false, flag: f.flag === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL', archived: false, sortOrder: Math.max(0, ...listsOf(p.id).map((x) => x.sortOrder)) + 1 };
      db.taskLists.push(l);
      return { id: l.id };
    }),
    updateTaskList: (portalId, id, f) => call(() => {
      const l = db.taskLists.find((x) => x.portalId === portalId && x.id === id) || fail('TASK_LIST_NOT_FOUND', 'That task list does not exist.');
      const { p, user, m } = needTaskProject(portalId, l.projectId);
      if (!canEditProject(p, user, m) || !may(m, 'TASKS_EDIT')) fail('FORBIDDEN', 'Only a project Manager or an Admin can manage task lists.');
      if (f.name !== undefined) {
        const name = String(f.name || '').trim();
        if (!name) fail('VALIDATION', 'Name the list.', { name: 'Name the list.' });
        if (name.length > LIST_NAME_MAX) fail('VALIDATION', `Use ${LIST_NAME_MAX} characters or fewer.`, { name: `Use ${LIST_NAME_MAX} characters or fewer.` });
        if (listsOf(p.id).some((x) => x.id !== l.id && x.name.toLowerCase() === name.toLowerCase())) fail('VALIDATION', 'A list with this name already exists in this project.', { name: 'A list with this name already exists in this project.' });
        l.name = name;
      }
      if (f.flag) l.flag = f.flag === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL';
    }),
    archiveTaskList: (portalId, id, archived = true) => call(() => {
      const l = db.taskLists.find((x) => x.portalId === portalId && x.id === id) || fail('TASK_LIST_NOT_FOUND', 'That task list does not exist.');
      const { p, user, m } = needTaskProject(portalId, l.projectId);
      if (!canEditProject(p, user, m) || !may(m, 'TASKS_EDIT')) fail('FORBIDDEN', 'Only a project Manager or an Admin can manage task lists.');
      if (archived && l.isDefault) fail('VALIDATION', 'The General list cannot be archived.');
      l.archived = archived;
    }),
    moveTaskList: (portalId, id, dir) => call(() => {
      const l = db.taskLists.find((x) => x.portalId === portalId && x.id === id) || fail('TASK_LIST_NOT_FOUND', 'That task list does not exist.');
      const { p, user, m } = needTaskProject(portalId, l.projectId);
      if (!canEditProject(p, user, m) || !may(m, 'TASKS_EDIT')) fail('FORBIDDEN', 'Only a project Manager or an Admin can manage task lists.');
      const list = listsOf(p.id), i = list.findIndex((x) => x.id === id), j = i + dir;
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]]; list.forEach((x, k) => { x.sortOrder = k; });
    }),

    /* ----- tasks ----- */
    /** Flat list for a project: the screen groups it by list. Filters: listId, statusType, ownerId ('NONE' = unassigned), priority, q, trashed. */
    tasks: (portalId, projectId, f = {}) => call(() => {
      const { p, user, m } = needTaskProject(portalId, projectId), lay = projectTaskLayout(portalId, p);
      ensureGeneralList(portalId, p.id);
      const q = String(f.q || '').trim().toLowerCase();
      const rows = db.tasks.filter((t) => t.projectId === p.id && !!t.deletedAt === !!f.trashed && (f.trashed ? !t.deletedWith : true)
        && (!f.listId || t.listId === f.listId) && (!f.priority || t.priority === f.priority)
        && (!f.statusType || statusOf(lay, t)?.type === f.statusType)
        && (!f.ownerId || (f.ownerId === 'NONE' ? !t.ownerIds.length : t.ownerIds.includes(f.ownerId)))
        && (!q || t.title.toLowerCase().includes(q) || t.key.toLowerCase().includes(q) || t.tags.some((x) => x.toLowerCase().includes(q))))
        .sort((a, b) => a.seq - b.seq).map((t) => taskRow(t, lay));
      return { tasks: rows, statuses: statusList(lay), canEdit: may(m, 'TASKS_EDIT') && canWork(p, user, m), canCreate: may(m, 'TASKS_CREATE') && canWork(p, user, m), canManageLists: canEditProject(p, user, m) && may(m, 'TASKS_EDIT'), canRestore: may(m, 'TASKS_DELETE') && canWork(p, user, m),
        project: { id: p.id, key: p.key, name: p.name }, layoutName: lay.name };
    }),
    /** Quick add is just { title }; the list defaults to General; a subtask (parentId) lives in its parent's list. Any other field can ride along. */
    createTask: (portalId, projectId, f) => call(() => {
      const { p, user, m } = needTaskProject(portalId, projectId);
      if (!may(m, 'TASKS_CREATE') || !canWork(p, user, m)) fail('FORBIDDEN', 'Your profile or project role does not allow creating tasks here.');
      ensureGeneralList(portalId, p.id);
      const lay = projectTaskLayout(portalId, p), parent = f.parentId ? taskById(portalId, f.parentId) : null;
      if (f.parentId && (!parent || parent.projectId !== p.id || parent.deletedAt)) fail('TASK_NOT_FOUND', 'The parent task does not exist.');
      if (parent && depthOf(parent) >= MAX_DEPTH) fail('VALIDATION', `Subtasks can go ${MAX_DEPTH} levels deep.`, { parentId: `Subtasks can go ${MAX_DEPTH} levels deep.` });
      const list = parent ? db.taskLists.find((l) => l.id === parent.listId) : (f.listId ? db.taskLists.find((l) => l.id === f.listId && l.projectId === p.id) : listsOf(p.id).find((l) => l.isDefault));
      if (!list) fail('TASK_LIST_NOT_FOUND', 'That task list does not exist.');
      if (list.archived && !parent) fail('VALIDATION', 'That list is archived. Unarchive it to add tasks.');
      const own = checkTaskFields(portalId, { title: f.title, ...(f.description !== undefined ? { description: f.description } : {}), ...Object.fromEntries(['priority', 'startDate', 'dueDate', 'workHours', 'completion', 'ownerIds', 'tags'].filter((k) => f[k] !== undefined).map((k) => [k, f[k]])) });
      if (f.statusId && !lay.statuses.some((x) => x.id === f.statusId)) fail('VALIDATION', "Pick a status from this project's task layout.", { statusId: 'Pick a status from the layout.' });
      const customValues = checkCustomValues(portalId, f.customValues, { creating: true, layout: lay });
      p.taskSeq = Math.max(p.taskSeq || 0, ...db.tasks.filter((x) => x.projectId === p.id).map((x) => x.seq)) + 1; // never reused, even after a delete
      const startStatus = lay.statuses.find((x) => x.id === f.statusId) || lay.statuses.find((x) => x.isDefault);
      const t = { id: 't' + token(), portalId, projectId: p.id, listId: list.id, parentId: parent?.id ?? null, seq: p.taskSeq, key: `${p.key}-T${p.taskSeq}`, title: own.title, description: own.description ?? '', ownerIds: own.ownerIds ?? [],
        statusId: startStatus.id, priority: own.priority ?? 'NONE', startDate: own.startDate ?? null, dueDate: own.dueDate ?? null, workHours: own.workHours ?? null, completion: startStatus.type === 'CLOSED' ? 100 : (own.completion ?? 0), prevCompletion: null,
        tags: own.tags ?? [], followerIds: [], customValues, createdBy: user.id, createdAt: Date.now(), closedAt: startStatus.type === 'CLOSED' ? Date.now() : null, deletedAt: null, deletedBy: null, deletedWith: null };
      follow(t, user.id); t.ownerIds.forEach((o) => follow(t, o)); // TSK-BR-12
      db.tasks.push(t);
      logTask(t, 'CREATED', { text: parent ? `Created the subtask under ${parent.key}` : 'Created the task' });
      return { id: t.id, key: t.key };
    }),
    task: (portalId, id) => call(() => {
      const { t, p, user, m, layout } = needTask(portalId, id, { any: true });
      const res = resolveLayout(portalId, layout), trashed = !!t.deletedAt;
      const fields = res.sections.flatMap((x) => x.fields), values = Object.fromEntries(fields.filter((f) => !isEmpty(t.customValues?.[f.apiName])).map((f) => [f.apiName, t.customValues[f.apiName]]));
      const ancestors = []; let cur = t; while (cur.parentId) { cur = db.tasks.find((x) => x.id === cur.parentId); ancestors.unshift({ id: cur.id, key: cur.key, title: cur.title }); }
      const work = canWork(p, user, m) && !trashed;
      const list = db.taskLists.find((l) => l.id === t.listId);
      return { ...taskRow(t, layout), description: t.description, tags: [...t.tags], customValues: values, layout: res, statuses: statusList(layout), ancestors, depth: ancestors.length + 1, maxDepth: MAX_DEPTH,
        list: { id: list.id, name: list.name }, lists: listsOf(p.id).filter((l) => !l.archived || l.id === list.id).map((l) => ({ id: l.id, name: l.name })),
        project: { id: p.id, key: p.key, name: p.name }, createdBy: { id: t.createdBy, name: personName(t.createdBy) }, createdAt: t.createdAt, closedAt: t.closedAt, trashed, deletedAt: t.deletedAt,
        deletedBy: t.deletedBy ? personName(t.deletedBy) : null, trashedWithParent: !!t.deletedWith,
        subtasks: kids(t).sort((a, b) => a.seq - b.seq).map((k) => taskRow(k, layout)),
        followers: t.followerIds.map((id) => ({ id, name: personName(id) })), isFollowing: t.followerIds.includes(user.id),
        comments: db.taskComments.filter((c) => c.taskId === t.id).sort((a, b) => a.createdAt - b.createdAt).map((c) => ({ id: c.id, body: c.body, authorId: c.authorId, authorName: personName(c.authorId), createdAt: c.createdAt, editedAt: c.editedAt, mine: c.authorId === user.id, canDelete: c.authorId === user.id || m.profile === 'ADMIN' })),
        activity: db.taskActivity.filter((a) => a.taskId === t.id).sort((a, b) => b.at - a.at).map((a) => ({ ...a, actorName: personName(a.actorId) })),
        canEdit: work && may(m, 'TASKS_EDIT'), canCreate: work && may(m, 'TASKS_CREATE'), canDelete: work && may(m, 'TASKS_DELETE'), canRestore: trashed && may(m, 'TASKS_DELETE') && canWork(p, user, m), canComment: canWork(p, user, m) && !trashed };
    }),
    /** Partial by presence, like PATCH /api/work/tasks/{id}: title, description, ownerIds, priority, startDate, dueDate, workHours, completion, tags, listId (top-level only). */
    updateTask: (portalId, id, f) => call(() => {
      const { t, p, user, layout } = needTaskEdit(portalId, id);
      const has = (k) => Object.prototype.hasOwnProperty.call(f, k);
      const patch = checkTaskFields(portalId, f, t);
      const closed = statusOf(layout, t)?.type === 'CLOSED';
      if (has('completion') && closed && patch.completion !== t.completion) fail('VALIDATION', 'A closed task is 100% complete. Reopen it to change the completion.', { completion: 'A closed task is 100% complete. Reopen it to change the completion.' });
      const label = { title: 'Title', description: 'Description', priority: 'Priority', startDate: 'Start date', dueDate: 'Due date', workHours: 'Work hours', completion: 'Completion', ownerIds: 'Owners', tags: 'Tags' };
      const show = (k, v) => (k === 'priority' ? PRIORITY_LABEL[v] : k === 'ownerIds' ? (v.length ? v.map(personName).join(', ') : 'None') : k === 'tags' ? (v.length ? v.join(', ') : 'None') : k === 'completion' ? `${v}%` : v == null || v === '' ? 'None' : String(v));
      if (has('listId') && f.listId !== t.listId) {
        if (t.parentId) fail('VALIDATION', "A subtask stays in its parent's list.");
        const nl = db.taskLists.find((l) => l.id === f.listId && l.projectId === p.id && !l.archived);
        if (!nl) fail('TASK_LIST_NOT_FOUND', 'That task list does not exist, or is archived.');
        const from = db.taskLists.find((l) => l.id === t.listId)?.name; t.listId = nl.id; descendants(t).forEach((d) => { d.listId = nl.id; });
        logTask(t, 'FIELD', { field: 'List', from, to: nl.name });
      }
      for (const k of Object.keys(patch)) {
        const before = t[k];
        if (JSON.stringify(before ?? null) === JSON.stringify(patch[k] ?? null)) continue;
        t[k] = patch[k];
        if (k === 'description') logTask(t, 'FIELD', { field: 'Description', text: 'Updated the description' });
        else logTask(t, 'FIELD', { field: label[k], from: show(k, before ?? (k === 'ownerIds' || k === 'tags' ? [] : null)), to: show(k, patch[k]) });
        if (k === 'ownerIds') patch.ownerIds.forEach((o) => follow(t, o));
      }
    }),
    /** The single status-change path (TSK-BR-05). Closed sets closedAt and completion 100; reopening restores the earlier completion. Closing a parent with open subtasks needs { confirm: true } (TSK-BR-07). */
    setTaskStatus: (portalId, id, statusId, { confirm = false } = {}) => call(() => {
      const { t, layout } = needTaskEdit(portalId, id);
      const next = layout.statuses.find((x) => x.id === statusId);
      if (!next) fail('VALIDATION', "Pick a status from this project's task layout.", { statusId: 'Pick a status from the layout.' });
      const was = statusOf(layout, t);
      if (was?.id === next.id) return;
      if (next.type === 'CLOSED' && was?.type !== 'CLOSED') {
        const open = descendants(t).filter((d) => statusOf(layout, d)?.type !== 'CLOSED').length;
        if (open && !confirm) fail('OPEN_SUBTASKS', `${open} subtask${open === 1 ? ' is' : 's are'} still open. They stay open if you close this task.`, { openSubtasks: open });
        t.prevCompletion = t.completion; t.completion = 100; t.closedAt = Date.now();
      } else if (next.type === 'OPEN' && was?.type === 'CLOSED') { t.completion = t.prevCompletion ?? 0; t.prevCompletion = null; t.closedAt = null; }
      t.statusId = next.id;
      logTask(t, 'STATUS', { field: 'Status', from: was?.name ?? 'Unknown', to: next.name });
    }),
    setTaskCustomValue: (portalId, id, apiName, value) => call(() => {
      const { t, layout } = needTaskEdit(portalId, id);
      const def = layoutFields(portalId, layout).find((d) => d.apiName === apiName);
      if (!def) fail('VALIDATION', "That field is inactive, or not in this task's layout.", { [apiName]: "That field is not in this task's layout." });
      const next = checkCustomValues(portalId, { [apiName]: value }, { existing: t.customValues || {}, creating: false, selfId: t.id, layout });
      if (JSON.stringify(next[apiName] ?? null) === JSON.stringify((t.customValues || {})[apiName] ?? null)) return;
      const fmt = (v) => (v == null ? 'None' : def.type === 'PICKLIST' ? def.options.find((o) => o.id === v)?.label ?? v : def.type === 'MULTI_PICKLIST' ? v.map((x) => def.options.find((o) => o.id === x)?.label ?? x).join(', ') : def.type === 'USER' ? personName(v) : def.type === 'CHECKBOX' ? (v ? 'Yes' : 'No') : String(v));
      logTask(t, 'FIELD', { field: def.label, from: fmt((t.customValues || {})[apiName]), to: fmt(next[apiName]) });
      t.customValues = next;
    }),
    /** Trash the task with all its subtasks. */
    trashTask: (portalId, id) => call(() => {
      const { t, user } = needTaskEdit(portalId, id, 'TASKS_DELETE'), now = Date.now();
      t.deletedAt = now; t.deletedBy = user.id; t.deletedWith = null;
      for (const d of descendants(t)) { d.deletedAt = now; d.deletedBy = user.id; d.deletedWith = t.id; }
      logTask(t, 'TRASHED', { text: 'Moved to the trash' });
    }),
    restoreTask: (portalId, id) => call(() => {
      const { t, p, user, m } = needTask(portalId, id, { trashed: true });
      if (!may(m, 'TASKS_DELETE') || !canWork(p, user, m)) fail('FORBIDDEN', 'Your profile or project role does not allow restoring tasks.');
      const parent = t.parentId && db.tasks.find((x) => x.id === t.parentId);
      if (parent?.deletedAt) fail('PARENT_TRASHED', `Restore ${parent.key} first. This subtask is in the trash because of it.`);
      const group = [t, ...db.tasks.filter((x) => x.deletedWith === t.id)];
      for (const x of group) { x.deletedAt = null; x.deletedBy = null; x.deletedWith = null; }
      logTask(t, 'RESTORED', { text: 'Restored from the trash' });
    }),
    addTaskFollower: (portalId, id, userId) => call(() => {
      const { t, p, user, m } = needTask(portalId, id);
      if (userId !== user.id && !(may(m, 'TASKS_EDIT') && canWork(p, user, m))) fail('FORBIDDEN', 'Only people who can edit the task can add other followers.');
      const mm = membership(portalId, userId); if (!mm || mm.status !== 'ACTIVE') fail('VALIDATION', 'Pick an active person in this portal.');
      if (t.followerIds.includes(userId)) return;
      follow(t, userId); logTask(t, 'FIELD', { field: 'Followers', from: null, to: `Added ${personName(userId)}` });
    }),
    removeTaskFollower: (portalId, id, userId) => call(() => {
      const { t, p, user, m } = needTask(portalId, id);
      if (userId !== user.id && !(may(m, 'TASKS_EDIT') && canWork(p, user, m))) fail('FORBIDDEN', 'Only people who can edit the task can remove other followers.');
      t.followerIds = t.followerIds.filter((x) => x !== userId); // an owner can unfollow: it only mutes notifications (TSK-BR-12)
    }),
    /**
     * Portal Tasks module: tasks across the projects the caller may see (GET /api/work/tasks). scope 'mine' = the caller is an owner; 'all' = everything visible.
     * A Client only gets tasks in External lists. Filters: projectId, statusType, ownerId ('NONE' = unassigned), priority, q. Sorted by due date (none last), then key.
     * `projects` lists the visible projects, with canCreate for the New task picker (TASKS_CREATE + project member or Admin).
     */
    allTasks: (portalId, f = {}) => call(() => {
      const { user, m } = requirePermission(portalId, 'TASKS_VIEW');
      const projs = db.projects.filter((p) => p.portalId === portalId && !p.deletedAt && canSee(p, user, m));
      const q = String(f.q || '').trim().toLowerCase(), client = m.profile === 'CLIENT', listOf = (id) => db.taskLists.find((l) => l.id === id);
      const rows = [];
      for (const p of projs) {
        if (f.projectId && f.projectId !== p.id) continue;
        const lay = projectTaskLayout(portalId, p);
        for (const t of db.tasks) {
          if (t.projectId !== p.id || t.deletedAt) continue;
          if (client && listOf(t.listId)?.flag !== 'EXTERNAL') continue;
          if (f.scope === 'mine' && !t.ownerIds.includes(user.id)) continue;
          const sts = statusOf(lay, t);
          if (f.statusType && sts?.type !== f.statusType) continue;
          if (f.priority && t.priority !== f.priority) continue;
          if (f.ownerId && !(f.ownerId === 'NONE' ? !t.ownerIds.length : t.ownerIds.includes(f.ownerId))) continue;
          if (q && !(t.title.toLowerCase().includes(q) || t.key.toLowerCase().includes(q) || t.tags.some((x) => x.toLowerCase().includes(q)))) continue;
          rows.push({ ...taskRow(t, lay), projectId: p.id, projectKey: p.key, projectName: p.name, listName: listOf(t.listId)?.name || '' });
        }
      }
      rows.sort((a, b) => (a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : (a.dueDate || '9999') > (b.dueDate || '9999') ? 1 : a.key.localeCompare(b.key, undefined, { numeric: true }));
      return { tasks: rows, today: isoToday(), projects: projs.map((p) => ({ id: p.id, key: p.key, name: p.name, canCreate: may(m, 'TASKS_CREATE') && canWork(p, user, m), canEdit: may(m, 'TASKS_EDIT') && canWork(p, user, m), statuses: statusList(projectTaskLayout(portalId, p)).map((x) => ({ id: x.id, name: x.name, type: x.type, color: x.color, isDefault: !!x.isDefault })) })).sort((a, b) => a.name.localeCompare(b.name)) };
    }),
    taskTags: (portalId) => call(() => { requirePermission(portalId, 'TASKS_VIEW'); const seen = new Map(); for (const t of db.tasks) if (t.portalId === portalId) for (const x of t.tags) if (!seen.has(x.toLowerCase())) seen.set(x.toLowerCase(), x); return [...seen.values()].sort(); }),
    addTaskComment: (portalId, taskId, body) => call(() => {
      const { t, p, user, m } = needTask(portalId, taskId);
      if (!canWork(p, user, m)) fail('FORBIDDEN', 'Only project members can comment.');
      const text = String(body || '').trim();
      if (!text) fail('VALIDATION', 'Write something first.');
      if (text.length > 5000) fail('VALIDATION', 'Use 5000 characters or fewer.');
      const c = { id: 'c' + token(), portalId, taskId: t.id, authorId: user.id, body: text, createdAt: Date.now(), editedAt: null };
      db.taskComments.push(c); logTask(t, 'COMMENT', { text: 'Added a comment' });
      return { id: c.id };
    }),
    updateTaskComment: (portalId, id, body) => call(() => {
      const user = requireUser(), c = db.taskComments.find((x) => x.portalId === portalId && x.id === id) || fail('COMMENT_NOT_FOUND', 'That comment does not exist.');
      needTask(portalId, c.taskId);
      if (c.authorId !== user.id) fail('FORBIDDEN', 'You can only edit your own comments.');
      const text = String(body || '').trim();
      if (!text) fail('VALIDATION', 'Write something first.');
      if (text.length > 5000) fail('VALIDATION', 'Use 5000 characters or fewer.');
      if (text !== c.body) { c.body = text; c.editedAt = Date.now(); }
    }),
    deleteTaskComment: (portalId, id) => call(() => {
      const user = requireUser(), c = db.taskComments.find((x) => x.portalId === portalId && x.id === id) || fail('COMMENT_NOT_FOUND', 'That comment does not exist.');
      const { t, m } = needTask(portalId, c.taskId);
      if (c.authorId !== user.id && m.profile !== 'ADMIN') fail('FORBIDDEN', 'You can only delete your own comments. Admins can delete any.');
      db.taskComments = db.taskComments.filter((x) => x !== c); logTask(t, 'COMMENT', { text: 'Deleted a comment' });
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
