// Off the Record: a classified folder that opens on hover; the TOP SECRET stamp pulls out
// one bookmark per case, and a bookmark opens that case's file (case.txt + photos/videos).
// Cases live in /Top secret/<folder>/ — add a folder, it becomes the next case.
(function () {
  var root = document.querySelector('.tsf');
  if (!root) return;
  var section = root.closest('section');
  var stage = root.querySelector('.tsf-stage');
  var folder = root.querySelector('.tsf-folder');
  var stamp = root.querySelector('.tsf-stamp');
  var tabsEl = root.querySelector('.tsf-tabs');
  var reseal = root.querySelector('.tsf-reseal');
  var mlist = document.createElement('div'); mlist.className = 'tsf-mlist';
  root.insertBefore(mlist, reseal);
  var modal = section.querySelector('.tsf-modal');
  var dossier = modal.querySelector('.tsf-dossier');
  var zoom = modal.querySelector('.tsf-zoom');
  var DESIGN_W = 860, DESIGN_H = 470;
  var IMG = /\.(jpe?g|png|gif|webp|avif|svg)$/i, VID = /\.(mp4|webm|m4v|mov|ogv)$/i;

  // the cover's DATE / ACTION / INITIAL log: empty ruled rows
  var rows = root.querySelector('.tsf-log-rows');
  for (var i = 0; i < 9; i++) rows.appendChild(document.createElement('div'));

  // ---- scale the fixed-size drawing to the column width ----
  function fit() {
    var s = Math.min(1, root.clientWidth / DESIGN_W);
    root.style.setProperty('--s', s.toFixed(4));
    root.classList.toggle('is-small', s < 0.72);                // phones: bookmarks also listed below, readable size
    stage.parentNode.style.setProperty('--stage-h', Math.round(DESIGN_H * s) + 'px');
  }
  fit();
  if (window.ResizeObserver) new ResizeObserver(fit).observe(root); else window.addEventListener('resize', fit);

  // ---- the cases ----
  var files = [];
  try { files = JSON.parse(document.getElementById('tsf-files').textContent) || []; } catch (e) {}
  var byFolder = {};
  files.forEach(function (p) {
    var parts = p.split('/'), at = parts.indexOf('Top secret');
    if (at < 0 || parts.length < at + 3) return;           // only files inside a case folder
    var name = parts[at + 1];
    (byFolder[name] = byFolder[name] || { folder: name, base: parts.slice(0, at + 2).join('/') + '/', text: null, media: [] });
    var file = parts.slice(at + 2).join('/');
    if (/^case\.txt$/i.test(file)) byFolder[name].text = p;
    else if (IMG.test(file) || VID.test(file)) byFolder[name].media.push(p);
  });
  var cases = Object.keys(byFolder).map(function (k) { return byFolder[k]; })
    .sort(function (a, b) { return a.folder.localeCompare(b.folder, undefined, { numeric: true }); });
  cases.forEach(function (c, i) {
    var m = c.folder.match(/\d+/);
    c.no = m ? parseInt(m[0], 10) : i;
    c.media.sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); });
    c.meta = { TITLE: c.folder.replace(/[-_]+/g, ' ').toUpperCase() };
  });

  function url(p) {                                         // spaces, Korean, emoji in paths
    return p.split('/').map(function (seg) { try { seg = decodeURIComponent(seg); } catch (e) {} return encodeURIComponent(seg); }).join('/');
  }
  function pad(n) { return ('00' + n).slice(-3); }

  // case.txt: optional header lines (TITLE: ..., SUBTITLE: ..., DATE: ..., STATUS: ..., LEVEL: ...), an optional '---', then the text.
  var KEYS = /^(TITLE|SUBTITLE|DATE|STATUS|LEVEL|CODENAME|LOCATION)\s*[:：]\s*(.*)$/i;
  function parse(txt) {
    var lines = txt.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n'), meta = {}, i = 0;
    while (i < lines.length && (KEYS.test(lines[i]) || (!lines[i].trim() && !Object.keys(meta).length))) {
      var m = lines[i].match(KEYS); if (m) meta[m[1].toUpperCase()] = m[2].trim(); i++;
    }
    if (i < lines.length && /^\s*-{3,}\s*$/.test(lines[i])) i++;
    var body = [], links = [];
    lines.slice(i).forEach(function (l) {
      var v = l.match(/^\s*(VIDEO|IMAGE|PHOTO|LINK)\s*[:：]\s*(\S+)\s*$/i);
      if (v) links.push({ kind: v[1].toUpperCase(), href: v[2] }); else body.push(l);
    });
    return { meta: meta, body: body.join('\n').replace(/^\n+|\n+$/g, ''), links: links };
  }
  var loading = null;
  function loadAll() {
    if (loading) return loading;
    loading = Promise.all(cases.map(function (c) {
      if (!c.text) return null;
      return fetch(url(c.text), { cache: 'no-cache' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
        c.parsed = parse(t);
        Object.keys(c.parsed.meta).forEach(function (k) { if (c.parsed.meta[k]) c.meta[k] = c.parsed.meta[k]; });
      }).catch(function () {});
    })).then(renderTabs);
    return loading;
  }

  // ---- bookmarks ----
  function renderTabs() {
    tabsEl.innerHTML = ''; mlist.innerHTML = '';
    var n = cases.length || 1, h = Math.min(58, Math.floor((DESIGN_H - 70) / n) - 6);
    tabsEl.style.setProperty('--tab-h', h + 'px');
    if (!cases.length) {
      var e = document.createElement('div'); e.className = 'tsf-tab is-empty'; e.innerHTML = '<small>NO FILES</small><b>Archive empty</b>';
      tabsEl.appendChild(e); return;
    }
    cases.forEach(function (c, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'tsf-tab'; b.setAttribute('role', 'listitem');
      b.style.setProperty('--i', i);
      b.innerHTML = '<small></small><b></b>';
      b.querySelector('small').textContent = 'CASE #' + pad(c.no);
      b.querySelector('b').textContent = c.meta.TITLE;
      if (c.meta.SUBTITLE) { var s = document.createElement('i'); s.textContent = c.meta.SUBTITLE; b.appendChild(s); }
      b.addEventListener('click', function () { openCase(c, b); });
      tabsEl.appendChild(b);
      var mb = b.cloneNode(true); mb.removeAttribute('role');
      mb.addEventListener('click', function () { openCase(c, mb); });
      mlist.appendChild(mb);
    });
  }
  renderTabs();

  // ---- open / close the folder ----
  function setOpen(on) { root.classList.toggle('is-open', on); if (on) loadAll(); }
  // a mouse opens it by hovering; a finger by tapping (tap the cover flap again to close)
  root.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') setOpen(true); });
  root.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !root.classList.contains('is-declassified')) setOpen(false); });
  root.addEventListener('focusin', function () { setOpen(true); });
  var wasOpen = false;                                       // (focus opens it before the click arrives)
  folder.addEventListener('pointerdown', function () { wasOpen = root.classList.contains('is-open'); });
  folder.addEventListener('click', function (e) {
    if (e.target.closest('.tsf-stamp')) return;
    if (!wasOpen) setOpen(true);
    else if (e.target.closest('.tsf-cover') && !root.classList.contains('is-declassified')) setOpen(false);
  });
  stamp.addEventListener('click', function (e) {
    e.stopPropagation();
    root.classList.add('is-open');
    root.classList.remove('is-stamping'); void stamp.offsetWidth; root.classList.add('is-stamping');
    loadAll().then(function () { root.classList.add('is-declassified'); });
  });
  reseal.addEventListener('click', function () { root.classList.remove('is-declassified', 'is-open', 'is-stamping'); });

  // ---- the case file ----
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function inline(s) {
    s = esc(s);
    s = s.replace(/\[\[([\s\S]+?)\]\]/g, '<span class="tsf-redact" tabindex="0" title="hover to reveal">$1</span>');   // [[hidden]]
    s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    s = s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    return s;
  }
  function body(text) {
    if (!text) return '<p class="tsf-d-empty">[ This file has not been written yet. ]</p>';
    return text.split(/\n\s*\n/).map(function (p) { return '<p>' + inline(p).replace(/\n/g, '<br>') + '</p>'; }).join('');
  }
  function ytId(h) { var m = h.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{6,})/); return m && m[1]; }
  var lastTab = null;
  function openCase(c, tab) {
    lastTab = tab;
    var p = c.parsed || { meta: {}, body: '', links: [] };
    dossier.querySelector('.tsf-d-no').textContent = 'CASE FILE #' + pad(c.no);
    dossier.querySelector('.tsf-d-title').textContent = c.meta.TITLE;
    var sub = dossier.querySelector('.tsf-d-sub'); sub.textContent = c.meta.SUBTITLE || ''; sub.hidden = !c.meta.SUBTITLE;
    var meta = dossier.querySelector('.tsf-d-meta'); meta.innerHTML = '';
    [['DATE', c.meta.DATE], ['STATUS', c.meta.STATUS || 'OPEN'], ['LEVEL', c.meta.LEVEL || 'EYES ONLY'], ['CODENAME', c.meta.CODENAME], ['LOCATION', c.meta.LOCATION]].forEach(function (kv) {
      if (!kv[1]) return; var d = document.createElement('div'); d.innerHTML = '<dt></dt><dd></dd>';
      d.firstChild.textContent = kv[0]; d.lastChild.textContent = kv[1]; meta.appendChild(d);
    });
    dossier.querySelector('.tsf-d-body').innerHTML = body(p.body);
    var grid = dossier.querySelector('.tsf-d-grid'); grid.innerHTML = '';
    var items = c.media.map(function (m) { return { kind: VID.test(m) ? 'VIDEO' : 'IMAGE', href: url(m), local: true }; }).concat(p.links);
    items.forEach(function (it, k) {
      var fig = document.createElement('figure'); fig.className = 'tsf-ev'; fig.style.setProperty('--tilt', ((k % 3) - 1) * 1.4 + 'deg');
      var label = 'EXHIBIT ' + String.fromCharCode(65 + (k % 26)) + (k >= 26 ? Math.floor(k / 26) : '');
      var yt = it.kind === 'VIDEO' && ytId(it.href);
      if (yt) { fig.classList.add('is-wide'); fig.innerHTML = '<div class="tsf-ev-frame"><iframe src="https://www.youtube-nocookie.com/embed/' + yt + '" title="' + label + '" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>'; }
      else if (it.kind === 'VIDEO') { fig.classList.add('is-wide'); var v = document.createElement('video'); v.src = it.href; v.controls = true; v.preload = 'metadata'; v.playsInline = true; fig.appendChild(v); }
      else if (it.kind === 'LINK') { var a = document.createElement('a'); a.href = it.href; a.target = '_blank'; a.rel = 'noopener'; a.className = 'tsf-ev-link'; a.textContent = it.href; fig.appendChild(a); }
      else { var im = document.createElement('img'); im.src = it.href; im.alt = label; im.loading = 'lazy'; im.addEventListener('click', function () { zoom.querySelector('img').src = im.src; zoom.hidden = false; }); fig.appendChild(im); }
      var cap = document.createElement('figcaption'); cap.textContent = label; fig.appendChild(cap);
      grid.appendChild(fig);
    });
    dossier.querySelector('.tsf-d-evidence').hidden = !items.length;
    dossier.querySelector('.tsf-d-path').textContent = '/Top secret/' + c.folder + '/';
    modal.hidden = false;
    document.documentElement.classList.add('tsf-locked');
    dossier.classList.remove('is-in'); void dossier.offsetWidth; dossier.classList.add('is-in');
    dossier.scrollTop = 0;
    dossier.querySelector('.tsf-close').focus({ preventScroll: true });
  }
  function closeCase() {
    if (modal.hidden) return;
    modal.querySelectorAll('video').forEach(function (v) { v.pause(); });
    modal.querySelectorAll('iframe').forEach(function (f) { f.src = 'about:blank'; });
    modal.hidden = true; zoom.hidden = true;
    document.documentElement.classList.remove('tsf-locked');
    if (lastTab) lastTab.focus({ preventScroll: true });
  }
  modal.querySelector('.tsf-close').addEventListener('click', closeCase);
  modal.querySelector('.tsf-modal-backdrop').addEventListener('click', closeCase);
  zoom.addEventListener('click', function () { zoom.hidden = true; });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!zoom.hidden) zoom.hidden = true; else closeCase();
  });
})();
