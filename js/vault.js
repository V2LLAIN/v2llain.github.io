// LEVEL 1 vault for Off the Record: an access-code lock in front of a TODO list that is written on the site
// and saved to a *secret GitHub Gist* in the owner's account. The page itself never holds the data:
// reading or writing needs a GitHub key (fine-grained token, Gists: read & write) that the owner enters
// once per device and that stays in that browser only. The access code just keeps the door shut.
(function () {
  var GIST_DESC = 'v2llain · Off the Record · TODO (private)', FILE = 'todo.json', API = 'https://api.github.com';
  var K_TOKEN = 'tsf-vault-token', K_GIST = 'tsf-vault-gist', K_CACHE = 'tsf-vault-cache', K_OPEN = 'tsf-vault-open';
  var ls = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  };
  function sha256hex(s) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    });
  }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function gh(path, opt) {
    opt = opt || {};
    var h = { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + ls.get(K_TOKEN), 'X-GitHub-Api-Version': '2022-11-28' };
    if (opt.body) h['Content-Type'] = 'application/json';
    return fetch(API + path, { method: opt.method || 'GET', headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined, cache: 'no-store' })
      .then(function (r) { if (!r.ok) { var e = new Error('GitHub ' + r.status); e.status = r.status; throw e; } return r.status === 204 ? null : r.json(); });
  }

  // ---------- the lock ----------
  function mount(box, opts) {
    box.innerHTML = '';
    var hash = (opts.lock || '').replace(/^sha256:/i, '').toLowerCase();
    var unlocked = false; try { unlocked = sessionStorage.getItem(K_OPEN) === hash; } catch (e) {}
    if (!hash || unlocked) return openVault(box);
    var lock = el('div', 'vlt-lock',
      '<div class="vlt-badge">LEVEL 1 · TOP SECRET</div>' +
      '<p class="vlt-warn">1급 기밀 — 인가된 요원 외 열람 금지<br><small>AUTHORIZED PERSONNEL ONLY · ACCESS CODE REQUIRED</small></p>' +
      '<div class="vlt-code" aria-hidden="true"><i></i><i></i><i></i><i></i></div>' +
      '<input class="vlt-input" type="password" inputmode="numeric" autocomplete="off" maxlength="8" aria-label="Access code">' +
      '<div class="vlt-pad"></div><p class="vlt-msg" aria-live="polite">ENTER ACCESS CODE</p>');
    box.appendChild(lock);
    var input = lock.querySelector('.vlt-input'), dots = lock.querySelectorAll('.vlt-code i'), msg = lock.querySelector('.vlt-msg'), pad = lock.querySelector('.vlt-pad');
    var code = '';
    var render = function () { dots.forEach(function (d, i) { d.classList.toggle('on', i < code.length); }); input.value = code; };
    var tryCode = function () {
      sha256hex('v2llain-vault:' + code).then(function (h) {
        if (h === hash) {
          msg.textContent = 'ACCESS GRANTED'; lock.classList.add('is-ok');
          try { sessionStorage.setItem(K_OPEN, hash); } catch (e) {}
          setTimeout(function () { openVault(box); }, 650);
        } else {
          msg.textContent = 'ACCESS DENIED'; lock.classList.remove('is-bad'); void lock.offsetWidth; lock.classList.add('is-bad');
          setTimeout(function () { code = ''; render(); msg.textContent = 'ENTER ACCESS CODE'; }, 700);
        }
      });
    };
    var press = function (k) {
      if (lock.classList.contains('is-ok')) return;
      if (k === 'C') code = ''; else if (k === '⌫') code = code.slice(0, -1); else if (code.length < 4) code += k;
      render(); if (code.length === 4) tryCode();
    };
    '1 2 3 4 5 6 7 8 9 C 0 ⌫'.split(' ').forEach(function (k) {
      var b = el('button', 'vlt-key', k); b.type = 'button'; b.addEventListener('click', function (e) { e.stopPropagation(); press(k); input.focus({ preventScroll: true }); }); pad.appendChild(b);
    });
    input.addEventListener('input', function () { code = input.value.replace(/\D/g, '').slice(0, 4); render(); if (code.length === 4) tryCode(); });
    lock.addEventListener('click', function () { input.focus({ preventScroll: true }); });
    setTimeout(function () { input.focus({ preventScroll: true }); }, 300);
  }

  // ---------- the vault: a TODO list kept in a secret gist ----------
  function openVault(box) {
    box.innerHTML = '';
    var v = el('div', 'vlt');
    v.innerHTML = '<div class="vlt-head"><span class="vlt-stamp">ACCESS GRANTED</span><span class="vlt-sync" data-s="idle">—</span></div>' +
      '<div class="vlt-body"></div>';
    box.appendChild(v);
    var bodyEl = v.querySelector('.vlt-body'), syncEl = v.querySelector('.vlt-sync');
    var status = function (s, txt) { syncEl.setAttribute('data-s', s); syncEl.textContent = txt; };
    if (!ls.get(K_TOKEN)) return keyForm();
    return list();

    function keyForm(err) {
      status('off', 'NOT LINKED');
      bodyEl.innerHTML = '<div class="vlt-key-form">' +
        '<h4>CLEARANCE KEY REQUIRED</h4>' +
        '<p>할 일은 사이트가 아니라 <b>본인 GitHub 계정의 비밀 Gist</b>에 저장됩니다. 이 기기에서 처음 한 번만 GitHub 키를 연결하면, 이후엔 이 화면에서 바로 쓰고 저장돼요. 키는 이 브라우저에만 보관되고 GitHub 외에는 어디로도 보내지지 않습니다.</p>' +
        '<ol><li><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → Fine-grained token 만들기</a></li>' +
        '<li>Expiration은 원하는 기간, <b>Account permissions → Gists: Read and write</b> 하나만 켜고 생성</li>' +
        '<li>생성된 키(github_pat_…)를 아래에 붙여넣기</li></ol>' +
        '<form><input type="password" placeholder="github_pat_…" autocomplete="off" spellcheck="false" aria-label="GitHub key"><button type="submit">LINK</button></form>' +
        '<p class="vlt-err" aria-live="polite">' + (err || '') + '</p></div>';
      var f = bodyEl.querySelector('form'), inp = f.querySelector('input'), e2 = bodyEl.querySelector('.vlt-err');
      f.addEventListener('submit', function (ev) {
        ev.preventDefault(); var t = inp.value.trim(); if (!t) return;
        ls.set(K_TOKEN, t); e2.textContent = 'VERIFYING…';
        gh('/user').then(function () { list(); }).catch(function (x) { ls.set(K_TOKEN, null); e2.textContent = x.status === 401 ? '키가 올바르지 않습니다.' : '연결 실패 (' + x.message + ')'; });
      });
      setTimeout(function () { inp.focus({ preventScroll: true }); }, 200);
    }

    function list() {
      var data = { v: 1, items: [] };
      try { var c = JSON.parse(ls.get(K_CACHE)); if (c && c.items) data = c; } catch (e) {}
      var gistId = ls.get(K_GIST), saveT = 0, saving = false, dirty = false, filter = 'open';
      bodyEl.innerHTML = '<form class="vlt-add"><input class="vlt-new" placeholder="새 지시사항 (할 일) 입력 후 Enter" aria-label="New task" maxlength="300">' +
        '<input class="vlt-due" type="date" aria-label="Due date"><button type="submit">ADD</button></form>' +
        '<div class="vlt-tabs"><button type="button" data-f="open">IN PROGRESS</button><button type="button" data-f="done">COMPLETED</button><button type="button" data-f="all">ALL</button></div>' +
        '<ul class="vlt-list"></ul><p class="vlt-empty"></p>' +
        '<div class="vlt-foot"><span class="vlt-count"></span><button type="button" class="vlt-unlink">UNLINK KEY</button></div>';
      var ul = bodyEl.querySelector('.vlt-list'), empty = bodyEl.querySelector('.vlt-empty'), cnt = bodyEl.querySelector('.vlt-count');
      var form = bodyEl.querySelector('.vlt-add'), nin = form.querySelector('.vlt-new'), din = form.querySelector('.vlt-due');
      bodyEl.querySelectorAll('.vlt-tabs button').forEach(function (b) { b.addEventListener('click', function () { filter = b.getAttribute('data-f'); draw(); }); });
      bodyEl.querySelector('.vlt-unlink').addEventListener('click', function () {
        if (!confirm('이 기기에서 GitHub 키 연결을 해제할까요? (저장된 할 일은 Gist에 그대로 남습니다)')) return;
        [K_TOKEN, K_GIST, K_CACHE].forEach(function (k) { ls.set(k, null); }); keyForm();
      });
      form.addEventListener('submit', function (e) {
        e.preventDefault(); var t = nin.value.trim(); if (!t) return;
        data.items.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: t, done: false, due: din.value || '', created: new Date().toISOString() });
        nin.value = ''; din.value = ''; filter = filter === 'done' ? 'open' : filter; changed();
      });
      var today = function () { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
      function draw() {
        bodyEl.querySelectorAll('.vlt-tabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-f') === filter); });
        var items = data.items.filter(function (it) { return filter === 'all' || (filter === 'done' ? it.done : !it.done); });
        if (filter !== 'done') items.sort(function (a, b) { return (a.done - b.done) || ((a.due || '9999') < (b.due || '9999') ? -1 : (a.due || '9999') > (b.due || '9999') ? 1 : 0); });
        ul.innerHTML = '';
        items.forEach(function (it) {
          var li = el('li', 'vlt-item' + (it.done ? ' is-done' : ''));
          var od = it.due && !it.done && it.due < today();
          li.innerHTML = '<button type="button" class="vlt-chk" aria-label="Done"></button><span class="vlt-txt" contenteditable="true" spellcheck="false"></span>' +
            (it.due ? '<span class="vlt-d' + (od ? ' is-late' : '') + '">' + it.due.replace(/-/g, '.') + (od ? ' · OVERDUE' : '') + '</span>' : '') +
            '<button type="button" class="vlt-del" aria-label="Delete">&times;</button>';
          var tx = li.querySelector('.vlt-txt'); tx.textContent = it.text;
          li.querySelector('.vlt-chk').addEventListener('click', function () { it.done = !it.done; it.doneAt = it.done ? new Date().toISOString() : ''; changed(); });
          li.querySelector('.vlt-del').addEventListener('click', function () { data.items = data.items.filter(function (x) { return x !== it; }); changed(); });
          tx.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); tx.blur(); } });
          tx.addEventListener('blur', function () { var t = tx.textContent.trim(); if (!t) { data.items = data.items.filter(function (x) { return x !== it; }); changed(); } else if (t !== it.text) { it.text = t; changed(true); } });
          ul.appendChild(li);
        });
        var open = data.items.filter(function (x) { return !x.done; }).length;
        cnt.textContent = 'OPEN ' + open + ' · DONE ' + (data.items.length - open);
        empty.textContent = items.length ? '' : (filter === 'done' ? '완료된 지시사항이 없습니다.' : '대기 중인 지시사항이 없습니다.');
      }
      function changed(noRedraw) { data.updated = new Date().toISOString(); ls.set(K_CACHE, JSON.stringify(data)); if (!noRedraw) draw(); dirty = true; status('busy', 'SAVING…'); clearTimeout(saveT); saveT = setTimeout(save, 700); }
      function save() {
        if (saving) { saveT = setTimeout(save, 500); return; }
        saving = true; dirty = false;
        var content = JSON.stringify(data, null, 1);
        var p = gistId ? gh('/gists/' + gistId, { method: 'PATCH', body: { files: { 'todo.json': { content: content } } } })
                       : gh('/gists', { method: 'POST', body: { description: GIST_DESC, public: false, files: { 'todo.json': { content: content } } } }).then(function (g) { gistId = g.id; ls.set(K_GIST, gistId); });
        p.then(function () { saving = false; if (!dirty) status('ok', 'SAVED · ' + new Date().toTimeString().slice(0, 5)); })
         .catch(function (e) { saving = false; dirty = true; if (e.status === 401) { ls.set(K_TOKEN, null); keyForm('키가 만료되었거나 취소되었습니다. 다시 연결해 주세요.'); } else status('err', 'SAVE FAILED — RETRY'); });
      }
      syncEl.addEventListener('click', function () { if (syncEl.getAttribute('data-s') === 'err') save(); });
      draw();
      // pull the latest from the gist (find it by its description on a new device)
      status('busy', 'SYNCING…');
      var find = gistId ? Promise.resolve(gistId) : gh('/gists?per_page=100').then(function (gs) { var g = gs.filter(function (x) { return x.description === GIST_DESC; })[0]; if (g) { gistId = g.id; ls.set(K_GIST, gistId); } return gistId; });
      find.then(function (id) {
        if (!id) { status('ok', data.items.length ? 'LOCAL' : 'READY'); if (data.items.length) save(); return; }
        return gh('/gists/' + id).then(function (g) {
          var f = g.files && g.files[FILE];
          var raw = f && (f.truncated ? fetch(f.raw_url).then(function (r) { return r.text(); }) : Promise.resolve(f.content));
          return Promise.resolve(raw).then(function (txt) {
            var remote = null; try { remote = JSON.parse(txt); } catch (e) {}
            if (remote && remote.items && !dirty && (!data.updated || !remote.updated || remote.updated >= data.updated)) { data = remote; ls.set(K_CACHE, JSON.stringify(data)); draw(); }
            else if (data.updated && remote && remote.updated && data.updated > remote.updated) save();
            if (!dirty) status('ok', 'SYNCED');
          });
        });
      }).catch(function (e) {
        if (e.status === 401) { ls.set(K_TOKEN, null); keyForm('키가 만료되었거나 취소되었습니다. 다시 연결해 주세요.'); }
        else if (e.status === 404) { ls.set(K_GIST, null); gistId = null; status('ok', 'READY'); }
        else status('err', 'OFFLINE — LOCAL COPY');
      });
    }
  }
  window.TSFVault = { mount: mount };
})();
