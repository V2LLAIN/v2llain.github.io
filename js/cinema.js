// "Absolute Cinema": click the profile photo → it opens into a vertical short — Life Force plays,
// the photos cut on the beat (B/W, grain, punch-ins), then it folds back into the circle.
(function () {
  var img = document.querySelector('.sidebar .profile-img');
  if (!img) return;
  var BASE = img.getAttribute('data-cinema') || 'images/cinema/';
  var S = BASE + 'scorsese.jpg', M = BASE + 'me.jpg';
  // focus points (% of each picture) for the punch-ins
  var F = {
    s: { face: [50, 31], lh: [12, 13], rh: [90, 14], text: [50, 72] },
    m: { face: [50, 38], lh: [9, 28], rh: [91, 30], text: [50, 71] }
  };
  // shot list, timed to the hits in the track (seconds)
  var SHOTS = [
    { t: 0.00, src: S, from: [1.00, 'face', 's'], to: [1.08] },
    { t: 1.90, src: S, from: [2.6, 'lh', 's'], to: [2.3] },
    { t: 3.85, src: S, from: [2.6, 'rh', 's'], to: [2.3] },
    { t: 5.80, src: S, from: [1.0, 'text', 's'], to: [1.7] },          // the swell: slow push in
    { t: 7.70, src: M, from: [1.25, 'face', 'm'], to: [1.0], flash: 1 },  // the twist
    { t: 9.60, src: M, from: [2.4, 'face', 'm'], to: [2.1] },
    { t: 11.55, src: M, from: [2.5, 'lh', 'm'], to: [2.2] },
    { t: 13.50, src: M, from: [1.0, 'text', 'm'], to: [1.6] },
    { t: 15.40, src: S, from: [1.15, 'face', 's'], to: [1.05], flash: 1 },
    { t: 16.35, src: M, from: [1.15, 'face', 'm'], to: [1.05] },
    { t: 17.30, src: S, from: [2.2, 'face', 's'], to: [2.0] },
    { t: 18.25, src: M, from: [2.2, 'face', 'm'], to: [2.0] },
    { t: 19.20, src: S, from: [2.4, 'rh', 's'], to: [2.2] },
    { t: 20.15, src: M, from: [2.4, 'rh', 'm'], to: [2.2] },
    { t: 21.10, src: M, from: [1.18, 'face', 'm'], to: [1.0], flash: 1 }   // hold on the poster
  ];
  var END = 24.6;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  img.classList.add('is-cinema');
  img.setAttribute('role', 'button'); img.setAttribute('tabindex', '0');
  img.setAttribute('title', 'ABSOLUTE CINEMA ▶');
  [S, M].forEach(function (u) { var p = new Image(); p.src = u; });

  var ov = null;
  function play() {
    if (ov) return;
    var audio = new Audio(BASE + 'life-force.mp3'); audio.preload = 'auto';
    // pause the sidebar record if it is playing
    var lp = document.querySelector('#lp-player audio'), lpWas = lp && !lp.paused;
    if (lpWas) lp.pause();

    ov = document.createElement('div'); ov.className = 'cine';
    ov.innerHTML = '<div class="cine-stage"><div class="cine-bg"></div><div class="cine-shot"><img alt=""></div>' +
      '<div class="cine-grain"></div><div class="cine-vig"></div><div class="cine-flash"></div><div class="cine-bar"><i></i></div>' +
      '<button type="button" class="cine-x" aria-label="Close">&times;</button></div>';
    document.body.appendChild(ov);
    document.documentElement.classList.add('cine-lock');
    var stage = ov.querySelector('.cine-stage'), shotImg = ov.querySelector('.cine-shot img'), bg = ov.querySelector('.cine-bg'),
        flash = ov.querySelector('.cine-flash'), bar = ov.querySelector('.cine-bar i');

    // grow out of the profile circle
    var H = Math.min(window.innerHeight * 0.92, window.innerWidth * 0.94 * 16 / 9), W = H * 9 / 16;
    stage.style.width = W + 'px'; stage.style.height = H + 'px';
    var from = img.getBoundingClientRect(), to = { left: (window.innerWidth - W) / 2, top: (window.innerHeight - H) / 2 };
    var fold = function () {
      var r = img.getBoundingClientRect(), sx = r.width / W, sy = r.height / H;
      return 'translate(' + (r.left - to.left) + 'px,' + (r.top - to.top) + 'px) scale(' + sx + ',' + sy + ')';
    };
    stage.style.left = to.left + 'px'; stage.style.top = to.top + 'px';
    if (!reduce) stage.animate([{ transform: fold(), borderRadius: '50%' }, { transform: 'none', borderRadius: '6px' }], { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)' });
    ov.animate([{ backgroundColor: 'rgba(0,0,0,0)' }, { backgroundColor: 'rgba(0,0,0,.92)' }], { duration: 500, fill: 'forwards' });

    var cur = -1, t0 = performance.now(), started = false, closing = false, raf = 0;
    audio.addEventListener('playing', function () { started = true; });
    var p = audio.play(); if (p && p.catch) p.catch(function () {});
    var clock = function () { return started && !audio.paused ? audio.currentTime : (performance.now() - t0) / 1000; };
    var pos = function (shot, k) {                        // scale + where the zoom is centred
      var f = F[shot.from[2]][shot.from[1]], s = k;
      return 'scale(' + s + ')';
    };
    function cut(i) {
      var sh = SHOTS[i], f = F[sh.from[2]][sh.from[1]], next = SHOTS[i + 1] ? SHOTS[i + 1].t : END, dur = Math.max(0.4, next - sh.t);
      if (shotImg.getAttribute('src') !== sh.src) { shotImg.src = sh.src; bg.style.backgroundImage = 'url("' + sh.src + '")'; }
      shotImg.style.transformOrigin = f[0] + '% ' + f[1] + '%';
      if (!reduce) {
        shotImg.animate([{ transform: pos(sh, sh.from[0]) }, { transform: pos(sh, sh.to[0]) }], { duration: dur * 1000, easing: 'cubic-bezier(.15,.6,.3,1)', fill: 'forwards' });
        stage.animate([{ scale: sh.flash ? 1.05 : 1.025 }, { scale: 1 }], { duration: 260, easing: 'cubic-bezier(.2,.8,.3,1)' });   // hit
        flash.animate([{ opacity: sh.flash ? 0.85 : 0.3 }, { opacity: 0 }], { duration: sh.flash ? 320 : 140, easing: 'ease-out' });
      } else shotImg.style.transform = pos(sh, sh.to[0]);
    }
    function tick() {
      raf = 0; if (closing) return;
      var t = clock();
      var i = cur; while (i + 1 < SHOTS.length && t >= SHOTS[i + 1].t) i++;
      if (i !== cur && i >= 0) { cur = i; cut(i); }
      bar.style.transform = 'scaleX(' + Math.min(1, t / END) + ')';
      if (t >= END) { close(); return; }
      raf = requestAnimationFrame(tick);
    }
    function close() {
      if (closing) return; closing = true; cancelAnimationFrame(raf);
      // fade the song out, fold back into the circle
      var v0 = audio.volume, tf = performance.now();
      (function fade() { var k = Math.min(1, (performance.now() - tf) / 700); audio.volume = v0 * (1 - k); if (k < 1) requestAnimationFrame(fade); else audio.pause(); })();
      var done = function () { ov.remove(); ov = null; document.documentElement.classList.remove('cine-lock'); if (lpWas) lp.play().catch(function () {}); img.focus({ preventScroll: true }); };
      if (reduce) { done(); return; }
      ov.animate([{ backgroundColor: 'rgba(0,0,0,.92)' }, { backgroundColor: 'rgba(0,0,0,0)' }], { duration: 650, fill: 'forwards' });
      stage.animate([{ transform: 'none', borderRadius: '6px', filter: 'none' }, { transform: fold(), borderRadius: '50%', filter: 'grayscale(1)' }],
        { duration: 650, easing: 'cubic-bezier(.6,0,.3,1)', fill: 'forwards' }).onfinish = done;
    }
    ov.addEventListener('click', close);
    var key = function (e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', key); } };
    document.addEventListener('keydown', key);
    cut(0); cur = 0; raf = requestAnimationFrame(tick);
  }
  img.addEventListener('click', play);
  img.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(); } });
})();
