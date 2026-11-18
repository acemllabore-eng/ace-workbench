/* Table tools for the Survey Unit panel: sort and filter on every table with column headers.
   The panel (index.html, addTableTools) adds this file to each app frame as it loads, the same way as the
   effects layer, so the app files (and their Apps Script copies) stay unchanged. Not affected by "Effects off".

   - Click a column header: sort A to Z (numbers and dates in order), again Z to A, a third time back to the
     app's own order. An arrow shows the sorted column.
   - The row under the headers filters: a list of the column's values when there are few, else a text box
     ("contains"). Filters on several columns combine. "Showing n of m · Clear filters" appears while filtering.
   - Apps redraw their tables often (every sync, every filter of their own): the choices are kept per table
     (by its column names) and applied again to the new table, until the page is reloaded.
   Only tables with a header row and at least 3 body rows of the same width get the tools; a table can opt out
   with data-tt="off". Rows the app shows are the ones sorted and filtered (a "Show more" page stays as it is). */
(function () {
  if (window.__awTableTools) return;
  window.__awTableTools = true;
  var MIN_ROWS = 3, LIST_MAX = 40, state = {};

  var css = [
    'th.tt-sort{cursor:pointer;user-select:none;white-space:nowrap}',
    'th.tt-sort:hover{color:inherit;opacity:.85}',
    'th.tt-sort .tt-arrow{display:inline-block;width:1em;margin-left:4px;opacity:.35;font-size:.85em}',
    'th.tt-sort[aria-sort=ascending] .tt-arrow,th.tt-sort[aria-sort=descending] .tt-arrow{opacity:1}',
    'tr.tt-frow th{padding-top:2px!important;padding-bottom:6px!important;position:static!important}',
    'tr.tt-frow select,tr.tt-frow input{width:100%;min-width:64px;box-sizing:border-box;font:inherit;font-size:12px;font-weight:400;',
    'text-transform:none;letter-spacing:0;padding:3px 4px;border-radius:6px;border:1px solid rgba(127,127,127,.35);background:transparent;color:inherit}',
    'tr.tt-frow select option{color:#111;background:#fff}',
    'tr.tt-frow .tt-on{border-color:currentColor;box-shadow:0 0 0 1px currentColor inset}',
    '.tt-note{font-size:12px;opacity:.85;margin:4px 2px 6px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}',
    '.tt-note button{font:inherit;background:none;border:0;padding:0;color:inherit;text-decoration:underline;cursor:pointer}',
    '@media print{tr.tt-frow,.tt-note,th.tt-sort .tt-arrow{display:none!important}}'
  ].join('');
  var st = document.createElement('style'); st.id = 'aw-tt-css'; st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  function txt(el) { return (el.innerText || el.textContent || '').replace(/ /g, ' ').trim(); }
  function first(el) { return txt(el).split('\n')[0].trim(); }      // a cell's main value, without its grey second line
  function norm(s) { return s.toLowerCase().replace(/\s+/g, ' '); }
  var MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  // Sort key: a number when the value is a number (commas, %, "days" allowed), a date when it reads as one, else text.
  function key(s) {
    var t = s.replace(/,/g, '').trim();
    var m = /^[-+]?\d+(\.\d+)?(\s*(%|days?|has?\.?|ha|sq\.? ?m|mins?|h))?$/i.exec(t);
    if (m) return { n: parseFloat(t) };
    m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t); if (m) return { n: Date.UTC(+m[1], +m[2] - 1, +m[3]) };
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t); if (m) return { n: Date.UTC(+m[3], +m[1] - 1, +m[2]) };
    m = /^([A-Za-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4})/.exec(t); if (m && MONTHS[m[1].toLowerCase()] !== undefined) return { n: Date.UTC(+m[3], MONTHS[m[1].toLowerCase()], +m[2]) };
    return { s: t };
  }
  var coll = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  function cmp(a, b) {
    if (a === '' || a === '—') return (b === '' || b === '—') ? 0 : 1;   // blanks last either way
    if (b === '' || b === '—') return -1;
    var x = key(a), y = key(b);
    if (x.n !== undefined && y.n !== undefined) return x.n - y.n;
    return coll.compare(a, b);
  }

  function headRow(t) { var h = t.tHead; if (!h) return null; var rows = [].filter.call(h.rows, function (r) { return !r.classList.contains('tt-frow'); }); return rows[rows.length - 1] || null; }
  function bodyRows(t) { var out = []; [].forEach.call(t.tBodies, function (b) { [].forEach.call(b.rows, function (r) { out.push(r); }); }); return out; }
  function fit(t) {
    if (t.dataset.tt === 'off' || t.closest('[data-tt=off]')) return null;
    var hr = headRow(t); if (!hr || hr.cells.length < 2) return null;
    if ([].some.call(hr.cells, function (c) { return c.colSpan > 1; })) return null;
    var rows = bodyRows(t); if (rows.length < MIN_ROWS) return null;
    var w = hr.cells.length;
    if (rows.some(function (r) { return r.cells.length !== w || [].some.call(r.cells, function (c) { return c.colSpan > 1; }); })) return null;
    return { hr: hr, rows: rows, w: w };
  }
  function tableKey(t, hr) {
    var all = [].slice.call(document.querySelectorAll('table'));
    return [].map.call(hr.cells, function (c) { return first(c); }).join('|') + '#' + all.filter(function (x) { var h = headRow(x); return h && [].map.call(h.cells, first).join('|') === [].map.call(hr.cells, first).join('|'); }).indexOf(t);
  }

  function apply(t) {
    var info = t.__tt; if (!info) return;
    var s = state[info.key], rows = bodyRows(t);
    // Sort (stable: rows equal on the column keep the app's order). Rows are moved inside their own tbody.
    if (s.sort) {
      var col = s.sort.col, dir = s.sort.dir;
      [].forEach.call(t.tBodies, function (b) {
        var rs = [].slice.call(b.rows).map(function (r, i) { return { r: r, i: i, v: first(r.cells[col] || r) }; });
        rs.sort(function (a, c) { var d = cmp(a.v, c.v); if (d && (a.v === '' || a.v === '—' || c.v === '' || c.v === '—')) return d; return (d * dir) || (a.i - c.i); });
        rs.forEach(function (x) { b.appendChild(x.r); });
      });
    } else if (info.order) {
      info.order.forEach(function (r) { if (r.parentNode) r.parentNode.appendChild(r); });
    }
    // Filter
    var shown = 0, f = s.filters, cols = Object.keys(f).filter(function (k) { return f[k] !== ''; });
    rows.forEach(function (r) {
      var ok = cols.every(function (k) {
        var c = r.cells[k]; if (!c) return true;
        return info.kinds[k] === 'list' ? first(c) === f[k] : norm(txt(c)).indexOf(norm(f[k])) >= 0;
      });
      r.hidden = !ok; if (ok) shown++;
    });
    [].forEach.call(info.hr.cells, function (c, i) {
      c.setAttribute('aria-sort', s.sort && s.sort.col === i ? (s.sort.dir > 0 ? 'ascending' : 'descending') : 'none');
      var a = c.querySelector('.tt-arrow'); if (a) a.textContent = s.sort && s.sort.col === i ? (s.sort.dir > 0 ? '▲' : '▼') : '↕';
    });
    [].forEach.call(info.frow.cells, function (c, i) { var x = c.firstChild; if (x) { if (x.value !== (f[i] || '')) x.value = f[i] || ''; x.classList.toggle('tt-on', !!f[i]); } });
    var note = info.note;
    if (cols.length) {
      note.hidden = false;
      note.firstChild.textContent = 'Showing ' + shown + ' of ' + rows.length + ' rows';
    } else note.hidden = true;
  }

  function enhance(t) {
    if (t.__tt) return;
    var g = fit(t); if (!g) return;
    var k = tableKey(t, g.hr);
    var s = state[k] = state[k] || { sort: null, filters: {} };
    var kinds = {}, frow = document.createElement('tr');
    frow.className = 'tt-frow';
    [].forEach.call(g.hr.cells, function (c, i) {
      // Header: click to sort
      if (!c.querySelector('.tt-arrow')) { var a = document.createElement('span'); a.className = 'tt-arrow'; a.setAttribute('aria-hidden', 'true'); a.textContent = '↕'; c.appendChild(a); }
      c.classList.add('tt-sort'); c.tabIndex = 0; c.title = 'Sort by ' + first(c);
      var go = function () {
        var cur = s.sort && s.sort.col === i ? s.sort.dir : 0;
        s.sort = cur === 0 ? { col: i, dir: 1 } : cur === 1 ? { col: i, dir: -1 } : null;
        apply(t);
      };
      c.addEventListener('click', function (e) { if (e.target.closest('a,button,input,select')) return; go(); });
      c.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      // Filter cell: a list of values when they are few, else a text box
      var vals = {}, n = 0;
      g.rows.forEach(function (r) { var v = first(r.cells[i]); if (!(v in vals)) { vals[v] = 1; n++; } });
      var th = document.createElement('th'), label = 'Filter ' + first(c);
      if (n <= LIST_MAX && n < g.rows.length) {
        kinds[i] = 'list';
        var sel = document.createElement('select'); sel.setAttribute('aria-label', label);
        var o = document.createElement('option'); o.value = ''; o.textContent = 'All'; sel.appendChild(o);
        Object.keys(vals).sort(cmp).forEach(function (v) { var op = document.createElement('option'); op.value = v; op.textContent = v === '' ? '(blank)' : v; sel.appendChild(op); });
        if (s.filters[i] && !(s.filters[i] in vals)) { var keep = document.createElement('option'); keep.value = s.filters[i]; keep.textContent = s.filters[i]; sel.appendChild(keep); }
        sel.addEventListener('change', function () { s.filters[i] = sel.value; apply(t); });
        th.appendChild(sel);
      } else {
        kinds[i] = 'text';
        var inp = document.createElement('input'); inp.type = 'search'; inp.placeholder = 'Filter'; inp.setAttribute('aria-label', label);
        inp.addEventListener('input', function () { s.filters[i] = inp.value; apply(t); });
        th.appendChild(inp);
      }
      frow.appendChild(th);
    });
    g.hr.parentNode.appendChild(frow);
    var note = document.createElement('div'); note.className = 'tt-note'; note.hidden = true;
    note.appendChild(document.createElement('span'));
    var clr = document.createElement('button'); clr.type = 'button'; clr.textContent = 'Clear filters';
    clr.addEventListener('click', function () { s.filters = {}; apply(t); });
    note.appendChild(clr);
    var host = t.parentNode && t.parentNode.classList && /table-scroll|scroll|wrap/.test(t.parentNode.className) ? t.parentNode : t;
    host.parentNode.insertBefore(note, host);
    t.__tt = { key: k, hr: g.hr, frow: frow, kinds: kinds, note: note, order: g.rows.slice() };
    apply(t);
  }

  function scan() { [].forEach.call(document.querySelectorAll('table'), function (t) { try { enhance(t); } catch (e) {} }); }
  var pending = false;
  // A timer, not requestAnimationFrame: a frame in a hidden tab or panel gets no animation frames.
  function later() { if (pending) return; pending = true; setTimeout(function () { pending = false; scan(); }, 30); }
  new MutationObserver(function (ms) {
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i];
      // Our own moves of rows and the note do not need a scan.
      if (m.target.closest && m.target.closest('.tt-note')) continue;
      later(); return;
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
  scan();
})();
