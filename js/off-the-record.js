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
    if (/^(case|agent)\.txt$/i.test(file)) byFolder[name].text = p;
    else if (IMG.test(file) || VID.test(file)) byFolder[name].media.push(p);
  });
  // the AGENT folder is not a case: it holds the agent's own file (agent.txt + the fanned photos)
  var agentKey = Object.keys(byFolder).filter(function (k) { return k.toUpperCase() === 'AGENT'; })[0];
  var agent = agentKey ? byFolder[agentKey] : { media: [], text: null };
  if (agentKey) delete byFolder[agentKey];
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
    var body = [], links = [], pins = [], hq = null;
    lines.slice(i).forEach(function (l) {
      var v = l.match(/^\s*(VIDEO|IMAGE|PHOTO|LINK)\s*[:：]\s*(\S+)\s*$/i);
      // PIN: 도시 | 연도 | 위도, 경도 | 사진파일      HQ: 도시 | 위도, 경도
      var pn = l.match(/^\s*(PIN|HQ)\s*[:：]\s*(.+)$/i);
      if (v) links.push({ kind: v[1].toUpperCase(), href: v[2] });
      else if (pn) {
        var f = pn[2].split('|').map(function (x) { return x.trim(); });
        var ll = f.filter(function (x) { return /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(x); })[0];
        if (!ll) { body.push(l); return; }
        var xy = ll.split(',').map(parseFloat), rest = f.filter(function (x) { return x !== ll; });
        if (pn[1].toUpperCase() === 'HQ') hq = { name: rest[0] || 'HQ', lat: xy[0], lon: xy[1] };
        else pins.push({ name: rest[0] || '', year: rest[1] || '', photo: rest[2] || '', lat: xy[0], lon: xy[1] });
      }
      else body.push(l);
    });
    return { meta: meta, body: body.join('\n').replace(/^\n+|\n+$/g, ''), links: links, pins: pins, hq: hq };
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
      if (c.meta.SUBTITLE) { var s = document.createElement('i'); s.innerHTML = redactOnly(c.meta.SUBTITLE); b.appendChild(s); }
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
    if (e.target.closest('.tsf-agent-card, .tsf-stamp-agent')) { if (wasOpen || root.classList.contains('is-open')) openAgent(e.target.closest('button')); return; }
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
  function redactOnly(s) { return esc(s).replace(/\[\[([\s\S]+?)\]\]/g, '<span class="tsf-redact-bar">$1</span>'); }   // bookmarks: just the black bar
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function inline(s) {
    s = esc(s);
    s = s.replace(/\[\[([\s\S]+?)\]\]/g, '<span class="tsf-redact" tabindex="0" title="hover to reveal">$1</span>');   // [[hidden]]
    s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    // links: [label](https://...) shows the label; a bare https://... address shows as "link"
    var links = [];
    var keep = function (href, label) { links.push('<a href="' + href + '" target="_blank" rel="noopener" title="' + href + '">' + label + ' <span class="tsf-link-arrow" aria-hidden="true">&#8599;</span></a>'); return '\u0000' + (links.length - 1) + '\u0000'; };
    s = s.replace(/\[([^\[\]]+)\]\((https?:\/\/[^\s)<]+)\)/g, function (m, label, href) { return keep(href, label); });
    s = s.replace(/https?:\/\/[^\s<]+/g, function (href) { return keep(href, 'link'); });
    return s.replace(/\u0000(\d+)\u0000/g, function (m, i) { return links[+i]; });
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
    var sub = dossier.querySelector('.tsf-d-sub'); sub.innerHTML = c.meta.SUBTITLE ? inline(c.meta.SUBTITLE) : ''; sub.hidden = !c.meta.SUBTITLE;
    var meta = dossier.querySelector('.tsf-d-meta'); meta.innerHTML = '';
    [['DATE', c.meta.DATE], ['STATUS', c.meta.STATUS || 'OPEN'], ['LEVEL', c.meta.LEVEL || 'EYES ONLY'], ['CODENAME', c.meta.CODENAME], ['LOCATION', c.meta.LOCATION]].forEach(function (kv) {
      if (!kv[1]) return; var d = document.createElement('div'); d.innerHTML = '<dt></dt><dd></dd>';
      d.firstChild.textContent = kv[0]; d.lastChild.textContent = kv[1]; meta.appendChild(d);
    });
    dossier.querySelector('.tsf-d-body').innerHTML = body(p.body);
    var mapEl = dossier.querySelector('.tsf-map'); if (mapEl) mapEl.remove();
    var pinned = (p.pins || []).map(function (pin) { return (pin.photo || '').toLowerCase(); });
    if (p.pins && p.pins.length) dossier.querySelector('.tsf-d-body').insertAdjacentElement('afterend', buildMap(c, p));
    var grid = dossier.querySelector('.tsf-d-grid'); grid.innerHTML = '';
    var items = c.media.filter(function (m) { return pinned.indexOf(m.split('/').pop().toLowerCase()) < 0; }).map(function (m) { return { kind: VID.test(m) ? 'VIDEO' : 'IMAGE', href: url(m), local: true }; }).concat(p.links);
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
  // ---- a world map with a pin per trip; a pin opens its photo right by the city ----
  var WORLD = section.getAttribute('data-world') || '/images/off-the-record/world.svg';
  function buildMap(c, p) {
    var pts = p.pins.concat(p.hq ? [p.hq] : []);
    // the part of the world to show: around the pins, at least 130 x 65 degrees, 2:1
    var lo0 = Math.min.apply(null, pts.map(function (q) { return q.lon; })), lo1 = Math.max.apply(null, pts.map(function (q) { return q.lon; }));
    var la0 = Math.min.apply(null, pts.map(function (q) { return q.lat; })), la1 = Math.max.apply(null, pts.map(function (q) { return q.lat; }));
    var w = Math.max(130, lo1 - lo0 + 50), h = Math.max(65, la1 - la0 + 40);
    if (w / h > 2) h = w / 2; else w = h * 2;
    w = Math.min(w, 360); h = Math.min(h, 145);
    var cx = (lo0 + lo1) / 2, cy = (la0 + la1) / 2;
    var L = Math.max(-180, Math.min(180 - w, cx - w / 2)), T = Math.min(85, Math.max(-60 + h, cy + h / 2));
    var X = function (lon) { return (lon - L) / w * 100; }, Y = function (lat) { return (T - lat) / h * 100; };
    var box = document.createElement('div'); box.className = 'tsf-map';
    box.style.aspectRatio = (w / h).toFixed(4);
    var view = document.createElement('div'); view.className = 'tsf-map-view'; box.appendChild(view);
    var world = document.createElement('img'); world.className = 'tsf-map-world'; world.src = WORLD; world.alt = ''; world.draggable = false;
    world.style.width = (360 / w * 100) + '%'; world.style.height = (180 / h * 100) + '%';
    world.style.left = (-(L + 180) / w * 100) + '%'; world.style.top = (-(90 - T) / h * 100) + '%';
    view.appendChild(world);
    // dashed flight routes from HQ
    if (p.hq) {
      var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'tsf-map-routes'); svg.setAttribute('viewBox', '0 0 100 ' + (100 * h / w).toFixed(3)); svg.setAttribute('preserveAspectRatio', 'none');
      var k = h / w, hx = X(p.hq.lon), hy = Y(p.hq.lat) * k;
      p.pins.forEach(function (pin, i) {
        var px = X(pin.lon), py = Y(pin.lat) * k, mx = (hx + px) / 2, my = (hy + py) / 2, dx = px - hx, dy = py - hy, d = Math.hypot(dx, dy) || 1;
        var bend = d * 0.22, qx = mx + dy / d * bend * (dx > 0 ? -1 : 1), qy = my - Math.abs(dx / d) * bend - 2;
        var path = document.createElementNS(NS, 'path');
        path.setAttribute('d', 'M' + hx + ' ' + hy + 'Q' + qx + ' ' + qy + ' ' + px + ' ' + py);
        path.style.animationDelay = (0.25 + i * 0.18) + 's';
        svg.appendChild(path);
      });
      view.appendChild(svg);
      var home = document.createElement('span'); home.className = 'tsf-hq';
      home.style.left = hx + '%'; home.style.top = Y(p.hq.lat) + '%';
      home.innerHTML = '<i></i><b></b>'; home.querySelector('b').textContent = 'HQ \u00b7 ' + p.hq.name;
      view.appendChild(home);
    }
    var pop = document.createElement('figure'); pop.className = 'tsf-map-pop'; pop.hidden = true;
    pop.innerHTML = '<div class="tsf-map-photo"></div><figcaption><b></b><span></span></figcaption>';
    box.appendChild(pop);
    var current = null;
    var pinsEls = p.pins.map(function (pin, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'tsf-pin';
      b.style.left = X(pin.lon) + '%'; b.style.top = Y(pin.lat) + '%'; b.style.animationDelay = (0.5 + i * 0.18) + 's';
      b.setAttribute('aria-label', (pin.year ? pin.year + ' ' : '') + pin.name);
      b.innerHTML = '<i></i><span class="tsf-pin-label"></span>';
      b.querySelector('.tsf-pin-label').textContent = (pin.year ? pin.year + ' \u00b7 ' : '') + pin.name;
      b.addEventListener('click', function (e) { e.stopPropagation(); if (current === b) hide(); else show(pin, b); });
      view.appendChild(b);
      return b;
    });
    // labels of pins that sit close together go to opposite sides
    requestAnimationFrame(function () {
      // pins too close to tell apart (small screens): nudge them apart, with a thin line back to the real spot
      var bw = box.clientWidth, bh = box.clientHeight;
      var at = pinsEls.map(function (el) { return { x: parseFloat(el.style.left) / 100 * bw, y: parseFloat(el.style.top) / 100 * bh, ox: 0, oy: 0 }; });
      for (var it = 0; it < 6; it++) at.forEach(function (q, i) {
        at.forEach(function (o, j) {
          if (j >= i) return;
          var dx = (q.x + q.ox) - (o.x + o.ox), dy = (q.y + q.oy) - (o.y + o.oy), d = Math.hypot(dx, dy);
          if (d >= 26) return;
          if (d < 0.5) { dx = 0.6; dy = 0.8; d = 1; }
          var push = (26 - d) / 2;
          q.ox += dx / d * push; q.oy += dy / d * push; o.ox -= dx / d * push; o.oy -= dy / d * push;
        });
      });
      at.forEach(function (q, i) {
        if (Math.hypot(q.ox, q.oy) < 2) return;
        pinsEls[i].style.translate = q.ox.toFixed(1) + 'px ' + q.oy.toFixed(1) + 'px';
        var lead = document.createElement('span'); lead.className = 'tsf-pin-lead';
        lead.style.left = (q.x / bw * 100) + '%'; lead.style.top = (q.y / bh * 100) + '%';
        lead.style.width = Math.hypot(q.ox, q.oy) + 'px'; lead.style.rotate = Math.atan2(q.oy, q.ox) + 'rad';
        view.insertBefore(lead, pinsEls[0]);
      });
      pinsEls.forEach(function (a, i) {
        pinsEls.slice(0, i).forEach(function (o) {
          var ra = a.getBoundingClientRect(), ro = o.getBoundingClientRect();
          if (Math.abs(ra.left - ro.left) < 90 && Math.abs(ra.top - ro.top) < 26) {
            (ra.top >= ro.top ? a : o).classList.add('label-below');
            (ra.left >= ro.left ? a : o).classList.add('label-right');
            (ra.left >= ro.left ? o : a).classList.add('label-left');
          }
        });
      });
      // keep every label inside the map: flip it below if it sticks out the top, slide it in from the sides
      var vr = view.getBoundingClientRect();
      pinsEls.forEach(function (el) {
        var lab = el.querySelector('.tsf-pin-label'), r = lab.getBoundingClientRect();
        if (r.top < vr.top + 2) { el.classList.add('label-below'); r = lab.getBoundingClientRect(); }
        else if (r.bottom > vr.bottom - 2) { el.classList.remove('label-below'); r = lab.getBoundingClientRect(); }
        var dx = r.left < vr.left + 3 ? vr.left + 3 - r.left : (r.right > vr.right - 3 ? vr.right - 3 - r.right : 0);
        if (dx) lab.style.marginLeft = dx.toFixed(1) + 'px';
      });
    });
    function show(pin, b) {
      if (current) current.classList.remove('is-on');
      current = b; b.classList.add('is-on');
      var holder = pop.querySelector('.tsf-map-photo'); holder.innerHTML = '';
      var file = pin.photo && c.media.filter(function (m) { return m.split('/').pop().toLowerCase() === pin.photo.toLowerCase(); })[0];
      if (file) {
        var im = document.createElement('img'); im.src = url(file); im.alt = pin.name; im.addEventListener('click', function (e) { e.stopPropagation(); zoom.querySelector('img').src = im.src; zoom.hidden = false; });
        holder.appendChild(im);
      } else holder.innerHTML = '<div class="tsf-map-nophoto"><span>PHOTO<br>CLASSIFIED</span></div>';
      pop.querySelector('b').textContent = pin.name; pop.querySelector('figcaption span').textContent = pin.year;
      pop.hidden = false;
      var off = (b.style.translate || '0px 0px').split(' ').map(parseFloat);
      var bw = box.clientWidth, bh = box.clientHeight, pw = Math.min(300, Math.max(170, bw * 0.46));
      pop.style.width = pw + 'px';
      var x = parseFloat(b.style.left) / 100 * bw + (off[0] || 0), y = parseFloat(b.style.top) / 100 * bh + (off[1] || 0) - 13;
      var right = x + 18 + pw <= bw || x < bw / 2, left = right ? x + 18 : x - 18 - pw;
      left = Math.max(-6, Math.min(bw - pw + 6, left));
      var ph = pop.offsetHeight, top = Math.max(-30, Math.min(bh - ph + 30, y - ph / 2));
      pop.style.left = left + 'px'; pop.style.top = top + 'px';
      pop.style.transformOrigin = (right ? 'left ' : 'right ') + Math.max(0, Math.min(ph, y - top)) + 'px';
      pop.classList.remove('is-in'); void pop.offsetWidth; pop.classList.add('is-in');
    }
    function hide() { if (current) current.classList.remove('is-on'); current = null; pop.hidden = true; }
    box.addEventListener('click', function (e) { if (!e.target.closest('.tsf-map-pop')) hide(); });
    var wrap = document.createElement('div'); wrap.className = 'tsf-map-wrap';
    var head = document.createElement('h4'); head.textContent = 'FIELD MAP'; wrap.appendChild(head);
    wrap.appendChild(box);
    var hint = document.createElement('p'); hint.className = 'tsf-map-hint'; hint.textContent = 'click a pin to see the field photo'; wrap.appendChild(hint);
    wrap.classList.add('tsf-map');               // (removed as one piece when another case opens)
    box.classList.remove('tsf-map'); box.classList.add('tsf-map-box');
    return wrap;
  }

  function closeCase() {
    if (modal.hidden) return;
    modal.querySelectorAll('video').forEach(function (v) { v.pause(); });
    modal.querySelectorAll('iframe').forEach(function (f) { f.src = 'about:blank'; });
    modal.hidden = true; zoom.hidden = true;
    document.documentElement.classList.remove('tsf-locked');
    if (lastTab) lastTab.focus({ preventScroll: true });
  }
  // a hidden link is uncovered by the first tap, followed by the next (a mouse uncovers it just by hovering)
  section.addEventListener('click', function (e) {
    var r = e.target.closest('.tsf-redact');
    if (!r || r.classList.contains('is-revealed')) return;
    r.classList.add('is-revealed');
    if (e.target.closest('a') && !r.matches(':hover')) e.preventDefault();
  });
  modal.querySelector('.tsf-close').addEventListener('click', closeCase);
  modal.querySelector('.tsf-modal-backdrop').addEventListener('click', closeCase);
  zoom.addEventListener('click', function () { zoom.hidden = true; });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (board && !board.hidden) { if (zoomed) unzoomPhoto(); else collect(); return; }
    if (!zoom.hidden) zoom.hidden = true; else if (!agentModal.hidden) closeAgent(); else closeCase();
  });

  // ---------- the agent's personnel file ----------
  var agentModal = section.querySelector('.tsf-agent');
  var fan = agentModal.querySelector('.tsf-fan');
  var agentLoaded = false, agentFrom = null;
  var fanPhotos = agent.media.filter(function (m) { return IMG.test(m); });
  var nameOf = function (p) { var f = p.split('/').pop().replace(/\.[^.]+$/, ''); try { f = decodeURIComponent(f); } catch (e) {} return f.replace(/^[\d\s._-]+/, '').replace(/[-_]+/g, ' ').trim(); };
  function buildFan() {
    fan.innerHTML = '';
    var n = fanPhotos.length, spread = Math.min(16, 46 / Math.max(1, n - 1));
    fanPhotos.forEach(function (src, i) {
      var c = document.createElement('figure'); c.className = 'tsf-fan-card';
      c.style.setProperty('--a', ((i - (n - 1) / 2) * spread).toFixed(2));
      c.style.setProperty('--i', i);
      var im = document.createElement('img'); im.src = url(src); im.alt = nameOf(src) || 'photo'; im.draggable = false; im.decoding = 'async';
      c.appendChild(im); c._src = url(src); c._label = 'EXHIBIT ' + String.fromCharCode(65 + i) + (nameOf(src) ? ' \u2014 ' + nameOf(src).toUpperCase() : '');
      fan.appendChild(c);
    });
    fan.hidden = !n; agentModal.querySelector('.tsf-fan-hint').hidden = !n;
  }
  function openAgent(from) {
    agentFrom = from;
    if (!agentLoaded) {
      agentLoaded = true; buildFan();
      if (agent.text) fetch(url(agent.text), { cache: 'no-cache' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
        var p = parse(t), m = p.meta;
        if (m.TITLE) agentModal.querySelector('.tsf-a-title').textContent = m.TITLE;
        var meta = agentModal.querySelector('.tsf-a-meta'); meta.innerHTML = '';
        [['CODENAME', m.CODENAME], ['STATUS', m.STATUS], ['LEVEL', m.LEVEL], ['DATE', m.DATE], ['LOCATION', m.LOCATION]].forEach(function (kv) {
          if (!kv[1]) return; var d = document.createElement('div'); d.innerHTML = '<dt></dt><dd></dd>';
          d.firstChild.textContent = kv[0]; d.lastChild.textContent = kv[1]; meta.appendChild(d);
        });
        meta.hidden = !meta.children.length;
        agentModal.querySelector('.tsf-a-body').innerHTML = p.body ? body(p.body) : '';
      }).catch(function () {});
    }
    agentModal.hidden = false;
    document.documentElement.classList.add('tsf-locked');
    var paper = agentModal.querySelector('.tsf-pfile');
    paper.classList.remove('is-in'); void paper.offsetWidth; paper.classList.add('is-in'); paper.scrollTop = 0;
    agentModal.querySelector('.tsf-close').focus({ preventScroll: true });
  }
  function closeAgent() {
    if (agentModal.hidden) return;
    agentModal.hidden = true; fan.classList.remove('is-spread');
    document.documentElement.classList.remove('tsf-locked');
    if (agentFrom) agentFrom.focus({ preventScroll: true });
  }
  agentModal.querySelector('.tsf-close').addEventListener('click', closeAgent);
  agentModal.querySelector('.tsf-modal-backdrop').addEventListener('click', closeAgent);

  // ---------- the photos: fanned under the file; clicked, they fly up and land across the screen ----------
  var board = null, zoomed = null, laying = false;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function boardLayout(aspects) {                            // justified rows that fit the window
    var vw = window.innerWidth, vh = window.innerHeight, W = vw - 40, H = vh - 110, gap = vw < 600 ? 14 : 26, pad = 10, foot = 30;
    var best = null;
    for (var rowH = Math.min(420, H); rowH >= 60; rowH -= 6) {
      var rows = [[]], x = 0;
      aspects.forEach(function (a, i) {
        var w = rowH * a + pad * 2;
        if (rows[rows.length - 1].length && x + w > W) { rows.push([]); x = 0; }
        rows[rows.length - 1].push({ i: i, w: w }); x += w + gap;
      });
      var total = rows.length * (rowH + pad + foot) + (rows.length - 1) * gap;
      if (total <= H && rows.every(function (r) { return r.reduce(function (s, c) { return s + c.w; }, 0) + gap * (r.length - 1) <= W; })) { best = { rows: rows, rowH: rowH, total: total }; break; }
    }
    if (!best) best = { rows: aspects.map(function (a, i) { return [{ i: i, w: 60 * a + pad * 2 }]; }), rowH: 60, total: aspects.length * 100 };
    var out = [], y = 64 + (H - best.total) / 2;
    best.rows.forEach(function (r) {
      var rw = r.reduce(function (s, c) { return s + c.w; }, 0) + gap * (r.length - 1), x = (vw - rw) / 2;
      r.forEach(function (c) {
        out[c.i] = { left: x + (Math.random() - 0.5) * 14, top: y + (Math.random() - 0.5) * 14, width: c.w, height: best.rowH + pad + foot, rot: (Math.random() - 0.5) * 9 };
        x += c.w + gap;
      });
      y += best.rowH + pad + foot + gap;
    });
    return out;
  }
  function boxOf(el) { var r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; }
  function px(b) { return { left: b.left + 'px', top: b.top + 'px', width: b.width + 'px', height: b.height + 'px' }; }
  function layOut() {
    if (laying || !fan.children.length) return;
    laying = true;
    if (!board) {
      board = document.createElement('div'); board.className = 'tsf-board'; board.hidden = true;
      board.innerHTML = '<p class="tsf-board-hint"><b>EVIDENCE</b> &middot; click a photo to look closer &middot; click anywhere to collect</p>';
      board.addEventListener('click', function (e) {
        var ph = e.target.closest('.tsf-board-photo');
        if (ph) { if (zoomed === ph) unzoomPhoto(); else zoomPhoto(ph); return; }
        if (zoomed) unzoomPhoto(); else collect();
      });
      document.body.appendChild(board);
    }
    var cards = Array.prototype.slice.call(fan.children);
    var aspects = cards.map(function (c) { var im = c.querySelector('img'); return im.naturalWidth ? im.naturalWidth / im.naturalHeight : 1; });
    var targets = boardLayout(aspects);
    board.hidden = false; void board.offsetWidth; board.classList.add('is-on');
    cards.forEach(function (c, i) {
      var from = boxOf(c), a = parseFloat(c.style.getPropertyValue('--a')) * (fan.matches(':hover') || fan.classList.contains('is-spread') ? 1.5 : 1);
      var f = document.createElement('figure'); f.className = 'tsf-board-photo'; f._card = c; f._rot = targets[i].rot; f._a = a;
      f.innerHTML = '<img alt=""><figcaption></figcaption>';
      f.querySelector('img').src = c._src; f.querySelector('img').alt = c.querySelector('img').alt; f.querySelector('figcaption').textContent = c._label;
      var t = targets[i]; Object.assign(f.style, px(t)); f.style.transform = 'rotate(' + t.rot.toFixed(2) + 'deg)'; f.style.zIndex = 10 + i;
      board.appendChild(f);
      c.style.visibility = 'hidden';
      if (!reduce && f.animate) {                              // up out of the fan, then slapped down: 착, 착, 착
        f.animate([
          Object.assign(px(from), { transform: 'rotate(' + a + 'deg) scale(1)', boxShadow: '0 4px 10px rgba(0,0,0,.3)' }),
          Object.assign(px({ left: (from.left + t.left) / 2, top: Math.min(from.top, t.top) - 60, width: (from.width + t.width) / 2, height: (from.height + t.height) / 2 }), { transform: 'rotate(' + (t.rot * 2) + 'deg) scale(1.12)', boxShadow: '0 40px 60px rgba(0,0,0,.45)', offset: 0.55 }),
          Object.assign(px(t), { transform: 'rotate(' + t.rot + 'deg) scale(1.05)', boxShadow: '0 24px 40px rgba(0,0,0,.5)', offset: 0.86 }),
          Object.assign(px(t), { transform: 'rotate(' + t.rot + 'deg) scale(1)', boxShadow: '0 18px 40px -12px rgba(0,0,0,.7)' })
        ], { duration: 560, delay: i * 120, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'backwards' });
      }
    });
    setTimeout(function () { laying = false; }, cards.length * 120 + 600);
  }
  function collect() {
    if (!board || board.hidden || laying) return;
    laying = true; unzoomPhoto(true);
    var photos = Array.prototype.slice.call(board.querySelectorAll('.tsf-board-photo'));
    var n = photos.length;
    photos.forEach(function (f, k) {
      var c = f._card, to = boxOf(c), from = boxOf(f), d = (n - 1 - k) * 80;     // back into the fan: 샥, 샥, 샥
      if (!reduce && f.animate) {
        var an = f.animate([
          Object.assign(px(from), { transform: 'rotate(' + f._rot + 'deg)' }),
          Object.assign(px(to), { transform: 'rotate(' + f._a + 'deg)' })
        ], { duration: 380, delay: d, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' });
        an.onfinish = function () { c.style.visibility = ''; f.remove(); };
      } else { c.style.visibility = ''; f.remove(); }
    });
    board.classList.remove('is-on');
    setTimeout(function () { board.hidden = true; laying = false; fan.classList.remove('is-spread'); }, reduce ? 0 : (n - 1) * 80 + 420);
  }
  function zoomPhoto(ph) {
    unzoomPhoto(true);
    zoomed = ph; ph._box = boxOf(ph);
    var im = ph.querySelector('img'), a = im.naturalWidth / im.naturalHeight || 1;
    var maxW = window.innerWidth * 0.9, maxH = window.innerHeight * 0.86 - 40;
    var h = Math.min(maxH, (maxW - 20) / a), w = h * a + 20;
    var t = { left: (window.innerWidth - w) / 2, top: (window.innerHeight - (h + 40)) / 2, width: w, height: h + 40 };
    ph.classList.add('is-zoomed'); board.classList.add('has-zoom');
    if (ph.animate && !reduce) ph.animate([Object.assign(px(ph._box), { transform: 'rotate(' + ph._rot + 'deg)' }), Object.assign(px(t), { transform: 'rotate(0deg)' })], { duration: 360, easing: 'cubic-bezier(.2,.8,.2,1)' });
    Object.assign(ph.style, px(t)); ph.style.transform = 'rotate(0deg)';
  }
  function unzoomPhoto(instant) {
    if (!zoomed) return;
    var ph = zoomed; zoomed = null; board.classList.remove('has-zoom');
    if (!instant && ph.animate && !reduce) ph.animate([Object.assign(px(boxOf(ph)), { transform: 'rotate(0deg)' }), Object.assign(px(ph._box), { transform: 'rotate(' + ph._rot + 'deg)' })], { duration: 320, easing: 'cubic-bezier(.4,0,.2,1)' });
    Object.assign(ph.style, px(ph._box)); ph.style.transform = 'rotate(' + ph._rot + 'deg)';
    ph.classList.remove('is-zoomed');
  }
  // a mouse spreads the fan just by moving onto it (CSS :hover); a finger taps once to spread, again to lay out
  var coarse = window.matchMedia && window.matchMedia('(hover: none)').matches;
  fan.addEventListener('click', function () {
    if (coarse && !fan.classList.contains('is-spread')) { fan.classList.add('is-spread'); return; }
    layOut();
  });
  if (coarse) agentModal.querySelector('.tsf-fan-hint-m').textContent = 'tap twice';
  fan.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); layOut(); } });
  window.addEventListener('resize', function () { if (board && !board.hidden && !laying) { unzoomPhoto(true); var ps = board.querySelectorAll('.tsf-board-photo'); var t = boardLayout(Array.prototype.map.call(ps, function (f) { var im = f.querySelector('img'); return im.naturalWidth / im.naturalHeight || 1; })); Array.prototype.forEach.call(ps, function (f, i) { Object.assign(f.style, px(t[i])); f._rot = t[i].rot; f.style.transform = 'rotate(' + t[i].rot + 'deg)'; }); } });
})();
