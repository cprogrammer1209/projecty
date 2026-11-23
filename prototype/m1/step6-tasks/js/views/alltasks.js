/*
 * M1 · Step 6 · Tasks module at portal level (tasks as a top-level module, like Zoho). Route #/p/:slug/tasks.
 *   My Tasks   tasks I own, open by default (Display → Closed tasks), grouped by due date by default (Overdue / Today / This week / Later / No due date).
 *   All Tasks  every task I may see, grouped by status by default, with a Project on every row.
 *   Both use the shared Linear-style list engine (js/views/tasklist.js): Display popover (List or Board, grouping), filter chips, inline pickers,
 *   bulk bar, quick add per group, New task (C), peek (Space), keyboard and Ctrl+K. Each tab keeps its own view, grouping and filters while you switch.
 * Rows open the same task page as the project tab (#/p/:slug/projects/:id/tasks/:tid?from=tasks|tasks-all); its back link returns here.
 * Visibility lives in Store.allTasks (members/public/admin; a Client only sees External lists).
 */
const AllTasks = (() => {
  const { esc, icon, component } = PY;

  function mount(el, ctx) {
    const portalId = ctx.portal.id;
    const s = { tab: ctx.query.tab === 'all' ? 'all' : 'mine', states: { mine: {}, all: {} }, people: [], notice: Tasks.ui.takeFlash(), canNew: false };
    let engine = null;
    const render = (s) => `<div class="users-page projects-page tasks-page portal-tasks">
        <div class="page-title"><div><h1>Tasks</h1><p>${s.tab === 'mine' ? 'Tasks assigned to you, across all projects.' : 'Every task in the projects you can see.'}</p></div></div>
        <nav class="ptabs" aria-label="Task views"><a href="#/p/${esc(ctx.slug)}/tasks" id="tab-mine" ${s.tab === 'mine' ? 'class="active" aria-current="page"' : ''}>My Tasks</a><a href="#/p/${esc(ctx.slug)}/tasks?tab=all" id="tab-all" ${s.tab === 'all' ? 'class="active" aria-current="page"' : ''}>All Tasks</a></nav>
        <div id="tv-host"></div></div>`;
    const load = async () => {
      const [d, people] = await Promise.all([Store.allTasks(portalId, { scope: s.tab }), s.people.length ? s.people : Store.projectPeople(portalId)]);
      s.people = people;
      return { tasks: d.tasks, projects: d.projects, lists: [], people, today: d.today };
    };
    const mountEngine = (notice) => {
      engine?.destroy();
      engine = TaskList.mount(el.querySelector('#tv-host'), { ctx, key: s.tab, state: s.states[s.tab], portal: true, mine: s.tab === 'mine', defaultGroup: s.tab === 'mine' ? 'due' : 'status', groups: ['status', 'list', 'owner', 'priority', 'due', 'none'],
        load, notice, from: s.tab === 'all' ? 'tasks-all' : 'tasks',
        emptyHint: s.tab === 'mine' ? 'Nothing assigned to you that is open. Tasks you own show up here.' : 'No tasks yet. Tasks from the projects you can see show up here.' });
    };
    const api = component(el, s, render, (el) => {
      [['mine', '#tab-mine'], ['all', '#tab-all']].forEach(([tab, sel]) => el.querySelector(sel).addEventListener('click', (e) => {
        e.preventDefault(); if (s.tab === tab) return;
        s.tab = tab; s.notice = null;
        history.replaceState(null, '', `#/p/${ctx.slug}/tasks${tab === 'all' ? '?tab=all' : ''}`); // no route change: each tab's state stays
        api.paint();
      }));
      mountEngine(s.notice); s.notice = null;
    });
    void icon;
  }

  return { mount };
})();
