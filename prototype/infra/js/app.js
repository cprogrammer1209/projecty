/* Page logic for the ProjectY infrastructure map. */
(function () {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const el = (tag, attrs, html) => {
    const node = document.createElement(tag);
    Object.keys(attrs || {}).forEach((k) => {
      if (k === 'class') node.className = attrs[k];
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), attrs[k]);
      else node.setAttribute(k, attrs[k]);
    });
    if (html != null) node.innerHTML = html;
    return node;
  };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ } }
  };
  const toolById = {};
  window.TOOLS.forEach((t) => { toolById[t.id] = t; });

  /* ---------------- theme ---------------- */
  function applyTheme(theme) {
    if (theme) document.documentElement.setAttribute('data-theme', theme);
    else document.documentElement.removeAttribute('data-theme');
  }
  applyTheme(store.get('py-infra-theme', null));
  $('#theme').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme')
      || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    store.set('py-infra-theme', next);
  });

  /* ---------------- stats ---------------- */
  (function stats() {
    const count = (s) => window.TOOLS.filter((t) => t.status === s).length;
    const items = [
      ['', window.TOOLS.length, 'tools and apps'],
      ['have', count('have'), 'already in ProjectY'],
      ['planned', count('planned'), 'recommended next'],
      ['optional', count('optional'), 'optional / advanced'],
      ['', Object.keys(window.DIAGRAMS).length, 'diagrams'],
      ['', window.ROADMAP.length, 'roadmap steps']
    ];
    $('#stats').innerHTML = items.map((i) => `<div class="stat ${i[0]}"><b>${i[1]}</b><span>${i[2]}</span></div>`).join('');
  })();

  /* ---------------- diagrams ---------------- */
  const LEGEND = [
    ['client', 'Client'], ['gateway', 'Gateway / proxy'], ['service', 'Service'], ['db', 'Database / store'],
    ['broker', 'Broker'], ['tool', 'Tool'], ['external', 'External'], ['process', 'Step'],
    ['decision', 'Decision'], ['event', 'Event'], ['bad', 'Failure']
  ];

  const SHORT_NAMES = {
    today: 'Today', target: 'Target', publish: 'Publish (outbox)', consume: 'Consume', auth: 'Token validation',
    retry: 'Retry and DLQ', cdc: 'Outbox vs CDC', saga: 'Saga', readmodel: 'Read models'
  };
  function mountSet(host, ids) {
    const tabs = el('div', { class: 'tabs', role: 'tablist' });
    const stage = el('div');
    host.appendChild(tabs);
    host.appendChild(stage);
    const buttons = {};
    let zoom = 1;

    function show(id) {
      const def = window.DIAGRAMS[id];
      Object.keys(buttons).forEach((k) => buttons[k].setAttribute('aria-selected', String(k === id)));
      stage.innerHTML = '';
      zoom = 1;

      const frame = el('div', { class: 'frame' });
      const head = el('div', { class: 'frame-head' }, `<div><h3>${esc(def.title)}</h3><p>${esc(def.lead)}</p></div>`);
      const zoomBox = el('div', { class: 'zoom' });
      const label = el('span', {}, '100%');
      const apply = () => { diagram.svg.style.width = Math.round(zoom * 100) + '%'; label.textContent = Math.round(zoom * 100) + '%'; };
      zoomBox.appendChild(el('button', { type: 'button', 'aria-label': 'Zoom out', onclick: () => { zoom = Math.max(0.6, zoom - 0.2); apply(); } }, '−'));
      zoomBox.appendChild(label);
      zoomBox.appendChild(el('button', { type: 'button', 'aria-label': 'Zoom in', onclick: () => { zoom = Math.min(2, zoom + 0.2); apply(); } }, '+'));
      head.appendChild(zoomBox);
      const canvas = el('div', { class: 'canvas' });
      const legend = el('div', { class: 'legend' });
      const kinds = new Set(def.nodes.map((nd) => nd.kind));
      legend.innerHTML = LEGEND.filter((l) => kinds.has(l[0]) || (l[0] === 'process' && kinds.has('terminal')))
        .map((l) => `<span><i class="sw-${l[0]}"></i>${l[1]}</span>`).join('')
        + (def.nodes.some((nd) => nd.planned) || (def.groups || []).some((g) => g.planned) ? '<span><i class="dashed" style="border-color:var(--muted)"></i>Not built yet</span>' : '');
      const detail = el('div', { class: 'detail', 'aria-live': 'polite' }, '<p class="hint">Click a box to see what it is.</p>');

      const diagram = window.renderDiagram(canvas, def, (node) => {
        if (!node) { detail.innerHTML = '<p class="hint">Click a box to see what it is.</p>'; return; }
        const title = String(node.label).replace(/\n/g, ' ');
        const text = node.info || (node.sub ? node.sub.replace(/\n/g, ' ') : 'No extra notes for this box.');
        detail.innerHTML = `<h4>${esc(title)}</h4><p>${esc(text)}</p>`;
        if (node.tool && toolById[node.tool]) {
          detail.appendChild(el('button', { class: 'btn', type: 'button', onclick: () => openTool(node.tool) }, `See the tool card: ${esc(toolById[node.tool].name)}`));
        }
      });

      frame.appendChild(head);
      frame.appendChild(canvas);
      frame.appendChild(legend);
      frame.appendChild(detail);
      stage.appendChild(frame);
      if (def.notes && def.notes.length) {
        stage.appendChild(el('ul', { class: 'notes' }, def.notes.map((t) => `<li>${t}</li>`).join('')));
      }
    }

    ids.forEach((id) => {
      const b = el('button', { class: 'tab', type: 'button', role: 'tab', onclick: () => show(id) }, esc(SHORT_NAMES[id]));
      buttons[id] = b;
      tabs.appendChild(b);
    });
    show(ids[0]);
  }

  mountSet($('#arch'), ['today', 'target']);
  mountSet($('#flowset'), ['publish', 'consume', 'auth', 'retry', 'cdc', 'saga', 'readmodel']);

  /* ---------------- tools ---------------- */
  const state = { q: '', status: 'all', cat: 'all' };
  const levelText = ['', 'Easy', 'Medium', 'Hard'];

  function chip(host, value, text, key) {
    const b = el('button', { class: 'chip', type: 'button', 'aria-pressed': String(state[key] === value), 'data-v': value }, esc(text));
    b.addEventListener('click', () => { state[key] = value; syncChips(); renderTools(); });
    host.appendChild(b);
  }
  function syncChips() {
    document.querySelectorAll('#statusChips .chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.v === state.status)));
    document.querySelectorAll('#catChips .chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.v === state.cat)));
  }
  chip($('#statusChips'), 'all', 'All', 'status');
  Object.keys(window.STATUS).forEach((s) => chip($('#statusChips'), s, window.STATUS[s], 'status'));
  chip($('#catChips'), 'all', 'All categories', 'cat');
  window.CATEGORIES.forEach((c) => chip($('#catChips'), c.id, c.name, 'cat'));
  $('#q').addEventListener('input', (ev) => { state.q = ev.target.value.trim().toLowerCase(); renderTools(); });

  function matches(t) {
    if (state.status !== 'all' && t.status !== state.status) return false;
    if (state.cat !== 'all' && t.cat !== state.cat) return false;
    if (!state.q) return true;
    const hay = [t.name, t.short, t.usage, t.learn.join(' ')].join(' ').toLowerCase();
    return state.q.split(/\s+/).every((w) => hay.includes(w));
  }

  function toolCard(t) {
    const d = el('details', { class: 'tool', id: 'tool-' + t.id });
    const dots = '●'.repeat(t.level) + '○'.repeat(3 - t.level);
    d.innerHTML =
      `<summary><div class="t-top"><span class="t-name">${esc(t.name)}</span><span class="badge ${t.status}">${esc(window.STATUS[t.status])}</span></div>` +
      `<div class="t-short">${esc(t.short)}</div><div class="level" title="Difficulty">${dots} ${levelText[t.level]}</div></summary>` +
      `<div class="t-body"><h4>In ProjectY</h4><p>${esc(t.usage)}</p>` +
      `<h4>Learn by building</h4><ul>${t.learn.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` +
      (t.pairs && t.pairs.length ? '<h4>Pairs with</h4><div class="pairs"></div>' : '') + '</div>';
    const pairs = $('.pairs', d);
    if (pairs) {
      t.pairs.filter((p) => toolById[p]).forEach((p) => {
        pairs.appendChild(el('button', { class: 'pair', type: 'button', onclick: () => openTool(p) }, esc(toolById[p].name)));
      });
    }
    return d;
  }

  function renderTools() {
    const host = $('#toolList');
    host.innerHTML = '';
    let shown = 0;
    window.CATEGORIES.forEach((c) => {
      const list = window.TOOLS.filter((t) => t.cat === c.id && matches(t));
      if (!list.length) return;
      shown += list.length;
      const block = el('div', { class: 'cat' }, `<h3>${esc(c.name)}</h3><p>${esc(c.blurb)}</p>`);
      const grid = el('div', { class: 'grid' });
      list.forEach((t) => grid.appendChild(toolCard(t)));
      block.appendChild(grid);
      host.appendChild(block);
    });
    if (!shown) host.appendChild(el('div', { class: 'empty' }, 'No tools match these filters.'));
    $('#count').textContent = `Showing ${shown} of ${window.TOOLS.length}`;
  }

  function openTool(id) {
    state.q = ''; state.status = 'all'; state.cat = 'all';
    $('#q').value = '';
    syncChips();
    renderTools();
    const card = document.getElementById('tool-' + id);
    if (!card) return;
    card.open = true;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.remove('flash');
    void card.offsetWidth;
    card.classList.add('flash');
  }
  renderTools();

  /* ---------------- roadmap ---------------- */
  const done = store.get('py-infra-progress', {});
  // Steps already built in ProjectY start ticked; the learner can still untick them.
  window.ROADMAP.forEach((s) => { if (s.built && done[s.n] === undefined) done[s.n] = true; });
  function renderRoadmap() {
    const road = $('#road');
    road.innerHTML = '';
    window.ROADMAP.forEach((s) => {
      const li = el('li', { class: 'step' + (done[s.n] ? ' done' : '') });
      li.innerHTML =
        `<div class="num">${s.n}</div><div><h3>${esc(s.title)}<label><input type="checkbox" ${done[s.n] ? 'checked' : ''}> Finished</label></h3>` +
        `<dl><dt>Build</dt><dd>${esc(s.build)}</dd><dt>You learn</dt><dd>${esc(s.learn)}</dd><dt>Done when</dt><dd>${esc(s.done)}</dd></dl>` +
        '<div class="pairs"></div></div>';
      $('input', li).addEventListener('change', (ev) => {
        done[s.n] = ev.target.checked;
        store.set('py-infra-progress', done);
        renderRoadmap();
      });
      s.tools.filter((id) => toolById[id]).forEach((id) => {
        $('.pairs', li).appendChild(el('button', { class: 'pair', type: 'button', onclick: () => openTool(id) }, esc(toolById[id].name)));
      });
      road.appendChild(li);
    });
    const finished = window.ROADMAP.filter((s) => done[s.n]).length;
    $('#bar').style.width = (finished / window.ROADMAP.length * 100) + '%';
    $('#progressText').textContent = `${finished} of ${window.ROADMAP.length} steps finished`;
  }
  renderRoadmap();

  /* ---------------- nav highlight ---------------- */
  const links = Array.from(document.querySelectorAll('#nav a'));
  const sections = links.map((a) => document.getElementById(a.getAttribute('href').slice(1)));
  function onScroll() {
    const y = window.scrollY + 90;
    let idx = 0;
    sections.forEach((s, i) => { if (s.offsetTop <= y) idx = i; });
    links.forEach((a, i) => a.classList.toggle('active', i === idx));
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (location.hash.startsWith('#tool-')) openTool(location.hash.slice(6));
})();
