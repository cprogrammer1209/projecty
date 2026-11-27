/* Renders a diagram definition (js/diagrams.js) to an inline SVG.
 * Exposes window.renderDiagram(host, def, onSelect) and returns { select(id), clear() }.
 */
(function () {
  const NS = 'http://www.w3.org/2000/svg';

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function anchor(node, side, abs) {
    const cx = node.x + node.w / 2;
    const cy = node.y + node.h / 2;
    switch (side) {
      case 't': return [abs != null ? abs : cx, node.y];
      case 'b': return [abs != null ? abs : cx, node.y + node.h];
      case 'l': return [node.x, abs != null ? abs : cy];
      default: return [node.x + node.w, abs != null ? abs : cy];
    }
  }

  /* Point on the border of a node, on the line from its centre towards (tx, ty). */
  function border(node, tx, ty) {
    const cx = node.x + node.w / 2;
    const cy = node.y + node.h / 2;
    const dx = tx - cx;
    const dy = ty - cy;
    if (dx === 0 && dy === 0) return [cx, cy];
    let t;
    if (node.kind === 'decision') t = 1 / (Math.abs(dx) / (node.w / 2) + Math.abs(dy) / (node.h / 2));
    else t = Math.min(dx === 0 ? Infinity : node.w / 2 / Math.abs(dx), dy === 0 ? Infinity : node.h / 2 / Math.abs(dy));
    return [cx + dx * t, cy + dy * t];
  }

  function route(edge, a, b) {
    let p0;
    let p1;
    if (edge.fs) p0 = anchor(a, edge.fs, edge.fa);
    if (edge.ts) p1 = anchor(b, edge.ts, edge.ta);
    if (!p0) p0 = border(a, b.x + b.w / 2, b.y + b.h / 2);
    if (!p1) p1 = border(b, a.x + a.w / 2, a.y + a.h / 2);
    let pts;
    if (edge.via) {
      pts = [p0].concat(edge.via, [p1]);
    } else if (edge.fs && edge.ts) {
      if (edge.fs === 't' || edge.fs === 'b') {
        const my = (p0[1] + p1[1]) / 2;
        pts = [p0, [p0[0], my], [p1[0], my], p1];
      } else {
        const mx = (p0[0] + p1[0]) / 2;
        pts = [p0, [mx, p0[1]], [mx, p1[1]], p1];
      }
    } else {
      pts = [p0, p1];
    }
    return pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
  }

  function nodeShape(nd) {
    const { x, y, w, h } = nd;
    switch (nd.kind) {
      case 'decision':
        return `<polygon points="${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}"/>`;
      case 'terminal':
      case 'bad':
      case 'event':
        return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(h / 2, 28)}"/>`;
      case 'db': {
        const ry = 7;
        return `<path d="M${x},${y + ry} A${w / 2},${ry} 0 0 1 ${x + w},${y + ry} V${y + h - ry} A${w / 2},${ry} 0 0 1 ${x},${y + h - ry} Z"/>` +
          `<path class="cap" d="M${x},${y + ry} A${w / 2},${ry} 0 0 0 ${x + w},${y + ry}"/>`;
      }
      default:
        return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/>`;
    }
  }

  function nodeText(nd) {
    const labelLines = String(nd.label).split('\n');
    const subLines = nd.sub ? String(nd.sub).split('\n') : [];
    const lh = 15;
    const slh = 13.5;
    const total = labelLines.length * lh + subLines.length * slh;
    const cx = nd.x + nd.w / 2;
    const dy = nd.kind === 'db' ? 4 : 0;
    let y = nd.y + nd.h / 2 - total / 2 + dy;
    let out = '';
    labelLines.forEach((line) => {
      y += lh;
      out += `<text class="lbl" x="${cx}" y="${y - 3.5}" text-anchor="middle">${esc(line)}</text>`;
    });
    subLines.forEach((line) => {
      y += slh;
      out += `<text class="sub" x="${cx}" y="${y - 3}" text-anchor="middle">${esc(line)}</text>`;
    });
    return out;
  }

  function build(def) {
    const byId = {};
    def.nodes.forEach((nd) => { byId[nd.id] = nd; });
    let svg = `<svg xmlns="${NS}" viewBox="0 0 ${def.w} ${def.h}" role="img" aria-label="${esc(def.title)}">`;
    svg += '<defs>' +
      '<marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" class="ah"/></marker>' +
      '<marker id="ahb" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" class="ah bad"/></marker>' +
      '</defs>';
    (def.groups || []).forEach((g) => {
      svg += `<g class="group${g.planned ? ' planned' : ''}"><rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="12"/>` +
        `<text x="${g.right ? g.x + g.w - 14 : g.x + 14}" y="${g.y + 20}"${g.right ? ' text-anchor="end"' : ''}>${esc(g.label)}</text></g>`;
    });
    let labels = '';
    def.edges.forEach((ed) => {
      const a = byId[ed.f];
      const b = byId[ed.t];
      const pts = route(ed, a, b);
      const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
      const cls = 'edge' + (ed.dash ? ' dash' : '') + (ed.bad ? ' bad' : '');
      const marker = ed.bad ? 'ahb' : 'ah';
      svg += `<path class="${cls}" d="${d}" marker-end="url(#${marker})"${ed.both ? ` marker-start="url(#${marker})"` : ''}/>`;
      if (ed.label) {
        const i = Math.floor((pts.length - 1) / 2);
        const vertical = pts[i][0] === pts[i + 1][0];
        const mx = (pts[i][0] + pts[i + 1][0]) / 2;
        const my = (pts[i][1] + pts[i + 1][1]) / 2;
        // a label on a vertical segment sits beside the line, otherwise it would cover the arrow
        const side = ed.lx == null && vertical;
        const lx = ed.lx != null ? ed.lx : (side ? mx + 8 : mx);
        const ly = ed.ly != null ? ed.ly : (side ? my + 4 : my - 5);
        labels += `<text class="elabel${ed.bad ? ' bad' : ''}" x="${lx}" y="${ly}" text-anchor="${side ? 'start' : 'middle'}">${esc(ed.label)}</text>`;
      }
    });
    def.nodes.forEach((nd) => {
      const cls = `node k-${nd.kind}${nd.planned ? ' planned' : ''}`;
      svg += `<g class="${cls}" data-id="${nd.id}" tabindex="0" role="button" aria-label="${esc(String(nd.label).replace(/\n/g, ' '))}">` +
        nodeShape(nd) + nodeText(nd) + '</g>';
    });
    svg += labels + '</svg>';
    return { svg, byId };
  }

  window.renderDiagram = function (host, def, onSelect) {
    const built = build(def);
    host.innerHTML = built.svg;
    const svg = host.querySelector('svg');
    svg.style.minWidth = Math.round(def.w * 0.6) + 'px';
    let current = null;

    function select(id) {
      if (current) current.classList.remove('selected');
      current = id ? svg.querySelector(`.node[data-id="${id}"]`) : null;
      if (current) current.classList.add('selected');
      if (onSelect) onSelect(id ? built.byId[id] : null);
    }

    svg.addEventListener('click', (ev) => {
      const g = ev.target.closest('.node');
      select(g ? g.getAttribute('data-id') : null);
    });
    svg.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      const g = ev.target.closest('.node');
      if (g) { ev.preventDefault(); select(g.getAttribute('data-id')); }
    });

    return { select, clear: () => select(null), svg };
  };
})();
