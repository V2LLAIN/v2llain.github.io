// "Absolute Cinema": click the profile photo → it bursts into a 4:3 black & white edit in the style of the
// "absolute cinema meme template": frantic cuts between the pictures (the original, the base photo, my version),
// "absolute cinema" title cards flashing in between, glitches, split screens, and a strobing collage at the end —
// all on Life Force's beat — then it folds back into the circle.
(function () {
  var img = document.querySelector('.sidebar .profile-img');
  if (!img) return;
  var BASE = img.getAttribute('data-cinema') || 'images/cinema/';
  var P = {                                          // picture + the point zooms centre on (% of the picture)
    s: { src: BASE + 'scorsese.jpg', f: [50, 34] },
    b: { src: BASE + 'base.jpg', f: [52, 36] },
    m: { src: BASE + 'me.jpg', f: [50, 40] }
  };
  var KEYS = ['s', 'b', 'm'];
  var B = 0.475;                                     // a quarter of Life Force's 1.9 s stab-to-stab
  // the edit, in beats (stabs land on 0, 4, 8 of each 16-beat phrase)
  var EDIT = [
    [0, 'pic', 's', 1.0, 1.06], [1, 'pic', 's', 1.18, 1.22], [2, 'text', 'sm'], [3, 'text', 'slide'],
    [4, 'pic', 'b', 1.0, 1.07], [5, 'glitch', 'b'], [6, 'text', 'lg'], [7, 'pic', 'm', 1.12, 1.16],
    [8, 'pic', 's', 1.0, 1.05], [9, 'text', 'bold'], [10, 'split', 'b', 'm'], [11, 'text', 'slideL'],
    [12, 'pic', 'm', 1.0, 1.06], [13, 'glitch', 's'], [14, 'text', 'sm'], [15, 'strobe'],
    [16, 'pic', 'b', 1.0, 1.06], [17, 'pic', 'b', 1.2, 1.25], [18, 'text', 'lg'], [19, 'split', 's', 'b'],
    [20, 'pic', 'm', 1.0, 1.07], [21, 'text', 'slide'], [22, 'glitch', 'm'], [23, 'text', 'bold'],
    [24, 'pic', 's', 1.0, 1.05], [25, 'split', 'm', 's'], [26, 'text', 'sm'], [27, 'pic', 'b', 1.15, 1.2],
    [28, 'glitch', 'b'], [29, 'text', 'slideL'], [30, 'strobe'],
    [32, 'final', 'm']
  ];
  var CUTS = EDIT.map(function (e) { return { t: e[0] * B, kind: e[1], a: e[2], b: e[3], c: e[4] }; });
  var END = 32 * B + 3.4;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  img.classList.add('is-cinema');
  img.setAttribute('role', 'button'); img.setAttribute('tabindex', '0');
  img.setAttribute('title', 'ABSOLUTE CINEMA ▶');
  var warmed = false;
  function warm() { if (warmed) return; warmed = true; KEYS.forEach(function (k) { var i = new Image(); i.src = P[k].src; }); }
  img.addEventListener('pointerenter', warm); img.addEventListener('focus', warm);

  var ov = null;
  function play() {
    if (ov) return;
    warm();
    var audio = new Audio(BASE + 'life-force.mp3'); audio.preload = 'auto';
    var lp = document.querySelector('#lp-player audio'), lpWas = lp && !lp.paused;
    if (lpWas) lp.pause();

    ov = document.createElement('div'); ov.className = 'cine';
    var cells = ''; for (var k = 0; k < 9; k++) cells += '<img alt="">';
    ov.innerHTML = '<div class="cine-stage">' +
      '<div class="cine-pic"><img class="p1" alt=""><img class="p2" alt=""></div>' +
      '<div class="cine-glitch"><img alt=""><img alt=""></div>' +
      '<div class="cine-collage">' + cells + '</div>' +
      '<div class="cine-text"><span>absolute cinema</span></div>' +
      '<div class="cine-grain"></div><div class="cine-vig"></div><div class="cine-flash"></div>' +
      '<div class="cine-bar"><i></i></div>' +
      '<button type="button" class="cine-x" aria-label="Close">&times;</button></div>';
    document.body.appendChild(ov);
    document.documentElement.classList.add('cine-lock');
    var q = function (s) { return ov.querySelector(s); };
    var stage = q('.cine-stage'), pic = q('.cine-pic'), p1 = q('.p1'), p2 = q('.p2'), gl = q('.cine-glitch'), gimgs = gl.querySelectorAll('img'),
        col = q('.cine-collage'), cimgs = col.querySelectorAll('img'), text = q('.cine-text'), flash = q('.cine-flash'), bar = q('.cine-bar i');

    var W = Math.min(window.innerWidth * 0.94, 920, window.innerHeight * 0.9 * 4 / 3), H = W * 3 / 4;
    stage.style.width = W + 'px'; stage.style.height = H + 'px'; stage.style.fontSize = (W / 640 * 16) + 'px';
    var to = { left: (window.innerWidth - W) / 2, top: (window.innerHeight - H) / 2 };
    stage.style.left = to.left + 'px'; stage.style.top = to.top + 'px';
    var fold = function () {
      var r = img.getBoundingClientRect();
      return 'translate(' + (r.left - to.left) + 'px,' + (r.top - to.top) + 'px) scale(' + (r.width / W) + ',' + (r.height / H) + ')';
    };
    if (!reduce) stage.animate([{ transform: fold(), borderRadius: '50%' }, { transform: 'none', borderRadius: '4px' }], { duration: 550, easing: 'cubic-bezier(.2,.8,.2,1)' });
    ov.animate([{ backgroundColor: 'rgba(0,0,0,0)' }, { backgroundColor: 'rgba(0,0,0,.94)' }], { duration: 400, fill: 'forwards' });

    var cur = -1, t0 = performance.now(), started = false, closing = false, raf = 0, strobeNext = 0;
    audio.addEventListener('playing', function () { started = true; });
    var pr = audio.play(); if (pr && pr.catch) pr.catch(function () {});
    var clock = function () { return started && !audio.paused ? audio.currentTime : (performance.now() - t0) / 1000; };

    var layers = function (on) { pic.style.display = on === 'pic' ? '' : 'none'; gl.style.display = on === 'glitch' ? '' : 'none'; col.style.display = on === 'strobe' ? '' : 'none'; text.style.display = on === 'text' ? '' : 'none'; };
    var setImg = function (el, key) { var pp = P[key]; if (el.getAttribute('src') !== pp.src) el.src = pp.src; el.style.transformOrigin = pp.f[0] + '% ' + pp.f[1] + '%'; };
    var zoom = function (el, a, b, dur) { if (reduce) { el.style.transform = 'scale(' + b + ')'; return; } el.animate([{ transform: 'scale(' + a + ')' }, { transform: 'scale(' + b + ')' }], { duration: dur * 1000, easing: 'linear', fill: 'forwards' }); };
    var hit = function (amt, ms) { if (reduce) return; flash.animate([{ opacity: amt }, { opacity: 0 }], { duration: ms || 120, easing: 'ease-out' }); };
    var bump = function () { if (!reduce) stage.animate([{ transform: 'scale(1.03)' }, { transform: 'none' }], { duration: 180, easing: 'ease-out' }); };

    function step(i) {
      var c = CUTS[i], next = CUTS[i + 1] ? CUTS[i + 1].t : END, dur = Math.max(0.15, next - c.t), beat = Math.round(c.t / B);
      var onStab = beat % 4 === 0;
      if (c.kind === 'pic' || c.kind === 'final') {
        layers('pic'); pic.classList.remove('is-split'); p2.style.display = 'none';
        setImg(p1, c.a);
        if (c.kind === 'final') { zoom(p1, 1.25, 1.0, dur * 0.9); hit(0.95, 500); bump(); }
        else { zoom(p1, c.b, c.c, dur); hit(onStab ? 0.5 : 0.18); if (onStab) bump(); }
      } else if (c.kind === 'split') {                  // two pictures side by side
        layers('pic'); pic.classList.add('is-split'); p2.style.display = '';
        setImg(p1, c.a); setImg(p2, c.b); zoom(p1, 1.1, 1.15, dur); zoom(p2, 1.15, 1.1, dur); hit(0.2);
      } else if (c.kind === 'glitch') {                 // horizontal slices jumping sideways
        layers('glitch'); gimgs.forEach(function (g) { setImg(g, c.a); });
        if (!reduce) {
          gimgs[1].animate([{ clipPath: 'inset(30% 0 52% 0)', transform: 'translateX(6%)' }, { clipPath: 'inset(58% 0 28% 0)', transform: 'translateX(-9%)', offset: 0.35 },
            { clipPath: 'inset(12% 0 76% 0)', transform: 'translateX(4%)', offset: 0.7 }, { clipPath: 'inset(44% 0 40% 0)', transform: 'translateX(-3%)' }], { duration: dur * 1000, easing: 'steps(6)', fill: 'forwards' });
          gimgs[0].animate([{ transform: 'scale(1.08)' }, { transform: 'scale(1.12)' }], { duration: dur * 1000, fill: 'forwards' });
        }
        hit(0.35);
      } else if (c.kind === 'text') {                   // the black "absolute cinema" cards
        layers('text'); text.className = 'cine-text t-' + c.a;
        var sp = text.querySelector('span');
        if (!reduce) {
          if (c.a === 'slide' || c.a === 'slideL') {
            var d = c.a === 'slide' ? 1 : -1;
            sp.animate([{ transform: 'translateX(' + (d * 45) + '%)' }, { transform: 'translateX(' + (-d * 25) + '%)' }], { duration: dur * 1000, easing: 'linear', fill: 'forwards' });
          } else sp.animate([{ transform: 'scale(1.12)', filter: 'blur(2px)' }, { transform: 'scale(1)', filter: 'blur(0)', offset: 0.25 }, { transform: 'scale(.97)', filter: 'blur(0)' }], { duration: dur * 1000, fill: 'forwards' });
        }
      } else if (c.kind === 'strobe') { layers('strobe'); strobeNext = 0; }
    }
    function strobe(t) {                                 // the frantic collage: re-shuffle every ~0.12 s
      if (t < strobeNext) return;
      strobeNext = t + 0.11 + Math.random() * 0.06;
      cimgs.forEach(function (ci, n) {
        var key = KEYS[Math.floor(Math.random() * 3)];
        if (n === 4) { ci.className = 'big'; ci.src = P[key].src; ci.style.opacity = Math.random() < 0.8 ? 1 : 0; return; }
        ci.className = ''; ci.src = P[key].src; ci.style.opacity = Math.random() < 0.85 ? 1 : 0;
      });
      col.style.filter = Math.random() < 0.4 ? 'brightness(1.8) contrast(1.4)' : '';
      hit(Math.random() < 0.45 ? 0.7 : 0.15, 90);
    }
    function tick() {
      raf = 0; if (closing) return;
      var t = clock();
      var i = cur; while (i + 1 < CUTS.length && t >= CUTS[i + 1].t) i++;
      if (i !== cur) { cur = i; step(i); }
      if (CUTS[cur].kind === 'strobe') strobe(t);
      bar.style.transform = 'scaleX(' + Math.min(1, t / END) + ')';
      if (t >= END) { close(); return; }
      raf = requestAnimationFrame(tick);
    }
    function close() {
      if (closing) return; closing = true; cancelAnimationFrame(raf);
      var v0 = audio.volume, tf = performance.now();
      (function fade() { var k2 = Math.min(1, (performance.now() - tf) / 700); audio.volume = v0 * (1 - k2); if (k2 < 1) requestAnimationFrame(fade); else audio.pause(); })();
      var done = function () { if (ov) ov.remove(); ov = null; document.documentElement.classList.remove('cine-lock'); document.removeEventListener('keydown', key); if (lpWas) lp.play().catch(function () {}); img.focus({ preventScroll: true }); };
      if (reduce) { done(); return; }
      ov.animate([{ backgroundColor: 'rgba(0,0,0,.94)' }, { backgroundColor: 'rgba(0,0,0,0)' }], { duration: 650, fill: 'forwards' });
      stage.animate([{ transform: 'none', borderRadius: '4px' }, { transform: fold(), borderRadius: '50%' }],
        { duration: 650, easing: 'cubic-bezier(.6,0,.3,1)', fill: 'forwards' }).onfinish = done;
    }
    ov.addEventListener('click', close);
    var key = function (e) { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', key);
    cur = 0; step(0); raf = requestAnimationFrame(tick);
  }
  img.addEventListener('click', play);
  img.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(); } });
})();
