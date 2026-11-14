// Not-yet-accepted publication cards (In Preparation / Submitted / Under Review). Their title / authors / TL;DR / image are not in the page or the repo:
// they live encrypted in /sealed/<id>.json and are only decrypted here, in the owner's browser, with the passphrase.
// The passphrase is never stored; reloading the page locks everything again.
(function () {
  function esc(s) { var d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML; }

  function load(id) {
    return fetch('/sealed/' + encodeURIComponent(id) + '.json', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('missing');
      return r.json();
    });
  }

  function reveal(card, p) {
    var box = card.querySelector('.sealed-img');
    if (box) {
      if (p.image) {
        var im = document.createElement('img');
        im.className = 'pub-card-img';
        im.alt = '';
        im.src = p.image;
        box.replaceWith(im);
      } else box.classList.add('sealed-img-empty');
    }
    var h3 = card.querySelector('.sealed-title');
    if (h3) { h3.className = ''; h3.textContent = p.title || '(untitled)'; }
    var au = card.querySelector('.sealed-authors');
    if (au) {
      au.classList.remove('sealed-authors');
      au.innerHTML = String(p.authors || '').split(',').map(function (a) {
        a = a.trim();
        return /Hyeongchan Im/.test(a) ? '<span class="me">' + esc(a) + '</span>' : esc(a);
      }).join(', ');
    }
    var links = card.querySelector('.sealed-links');
    if (links) {
      var h = '';
      if (p.url && /^https?:\/\//i.test(p.url) && !card.querySelector('.pub-public-link')) h += '<a class="pub-link" href="' + esc(p.url) + '" target="_blank" rel="noopener noreferrer"><i class="fas fa-file-alt"></i> Paper</a>';
      h += '<button type="button" class="pub-link sealed-relock"><i class="fas fa-lock"></i> Lock</button>';
      links.innerHTML = h;
    }
    var venue = card.querySelector('.pub-venue');
    if (venue && p.venue) venue.insertAdjacentHTML('afterbegin', '<span class="pub-venue-tag">' + esc(p.venue) + '</span>');
    var tl = card.querySelector('.tldr-locked');
    if (tl) { tl.classList.remove('tldr-locked'); tl.innerHTML = 'TL;DR <i class="fas fa-lock-open"></i>'; }
    var sum = card.querySelector('.sealed-summary');
    if (sum) sum.innerHTML = window.SealCrypto.safeInline(p.summary) || '<em>No TL;DR yet.</em>';
    card.classList.add('unsealed');
  }

  function relockAll() {
    document.querySelectorAll('.pub-sealed.unsealed').forEach(function (card) {
      card.innerHTML = card.__sealedHTML;
      card.classList.remove('unsealed');
      drawPeek(card);
    });
  }

  function tryOpen(card, pw) {
    return load(card.getAttribute('data-sealed'))
      .then(function (rec) { return window.SealCrypto.open(rec, pw); })
      .then(function (p) { reveal(card, p); });
  }

  // Title that peeks through the fold. Drawn on a canvas, never put in the page as text.
  function b64text(b) {
    try {
      var bin = atob(b), u = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return new TextDecoder().decode(u);
    } catch (e) { return ''; }
  }
  function drawPeek(card) {
    var cv = card.querySelector('.pub-peek-title');
    if (!cv) return;
    var w = cv.clientWidth, h = cv.clientHeight, dpr = window.devicePixelRatio || 1;
    if (!w || !h) return;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    var g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    var text = b64text(card.getAttribute('data-peek') || '').trim();
    var lineH = 21, size = 16;
    if (!text) {   // no title given: grey placeholder strokes
      g.fillStyle = 'rgba(255,255,255,.22)';
      g.fillRect(0, 5, w * .78, 10); g.fillRect(0, 26, w * .52, 10);
      return;
    }
    var fam = getComputedStyle(card).fontFamily || 'sans-serif';
    g.font = '700 ' + size + 'px ' + fam;
    g.fillStyle = '#fff';
    g.textBaseline = 'top';
    var words = text.split(/\s+/), lines = [''], k = 0;
    for (var i = 0; i < words.length && k < 2; i++) {
      var t = lines[k] ? lines[k] + ' ' + words[i] : words[i];
      if (g.measureText(t).width <= w || !lines[k]) lines[k] = t;
      else { k++; if (k < 2) lines[k] = words[i]; }
    }
    lines.slice(0, 2).forEach(function (ln, j) { g.fillText(ln, 0, 1 + j * lineH); });
  }

  function init() {
    document.querySelectorAll('.pub-sealed').forEach(drawPeek);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { document.querySelectorAll('.pub-sealed').forEach(drawPeek); });
    // the card may be hidden (other tab) at load: draw again when it becomes visible
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.pub-filter')) setTimeout(function () { document.querySelectorAll('.pub-sealed').forEach(drawPeek); }, 0);
    });
    if (!window.crypto || !crypto.subtle || !window.SealCrypto) return;
    document.querySelectorAll('.pub-sealed').forEach(function (card) { card.__sealedHTML = card.innerHTML; });

    document.addEventListener('click', function (e) {
      if (!e.target.closest) return;
      var key = e.target.closest('.pub-sealed .sealed-key');
      if (key) {
        var input = key.parentElement.querySelector('.sealed-pass');
        input.hidden = !input.hidden;
        key.parentElement.classList.toggle('open', !input.hidden);
        if (!input.hidden) input.focus();
        return;
      }
      if (e.target.closest('.pub-sealed .sealed-relock')) relockAll();
    });

    document.addEventListener('submit', function (e) {
      var form = e.target.closest && e.target.closest('.pub-sealed .sealed-unlock');
      if (!form) return;
      e.preventDefault();
      var card = form.closest('.pub-sealed'), input = form.querySelector('.sealed-pass'), msg = form.querySelector('.sealed-msg');
      var pw = input.value;
      if (!pw) return;
      msg.textContent = 'unlocking…';
      input.disabled = true;
      tryOpen(card, pw).then(function () {
        // the same passphrase usually opens the other sealed papers too
        document.querySelectorAll('.pub-sealed[data-sealed]:not(.unsealed)').forEach(function (c) { tryOpen(c, pw).catch(function () {}); });
      }).catch(function (err) {
        input.disabled = false;
        input.value = '';
        input.focus();
        msg.textContent = err && err.message === 'missing' ? 'sealed file not found' : 'wrong passphrase';
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
