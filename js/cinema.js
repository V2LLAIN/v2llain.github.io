// "Absolute Cinema": click the profile photo → it opens into a vertical short in the style of the
// "Absolute Cinema" edits — caption bar on top, glowing ABSOLUTE CINEMA title cards, the three pictures
// (the original, the base photo, my version) punched in and cut on Life Force's beat — then it folds back.
(function () {
  var img = document.querySelector('.sidebar .profile-img');
  if (!img) return;
  var BASE = img.getAttribute('data-cinema') || 'images/cinema/';
  var CAPTION = img.getAttribute('data-cinema-caption') || 'POV: the experiment finally works on the first try';
  var P = {                                          // picture + the point the punch-in centres on (% of the picture)
    s: { src: BASE + 'scorsese.jpg', face: [50, 30] },
    b: { src: BASE + 'base.jpg', face: [52, 33] },
    m: { src: BASE + 'me.jpg', face: [50, 38] }
  };
  // the timeline (seconds into Life Force); hits land at 0, 1.9, 3.85 and 7.7
  var CUTS = [
    { t: 0.00, kind: 'title' },                                   // glowing ABSOLUTE CINEMA on black
    { t: 1.90, kind: 'pic', p: 's', z: [1.42, 1.55] },
    { t: 2.85, kind: 'pic', p: 's', z: [1.75, 1.9] },             // punch in on the same shot
    { t: 3.85, kind: 'pic', p: 'b', z: [1.42, 1.55] },
    { t: 4.80, kind: 'pic', p: 'b', z: [1.75, 1.9] },
    { t: 5.80, kind: 'title', ghost: 1 },                         // the swell: the title again, doubled
    { t: 6.95, kind: 'whip', p: 'm' },                            // motion-blurred whip into the last shot
    { t: 7.70, kind: 'pic', p: 'm', z: [1.5, 1.22], flash: 1 },   // the drop: my version, easing out
    { t: 10.9, kind: 'end' }
  ];
  var END = 11.6;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  img.classList.add('is-cinema');
  img.setAttribute('role', 'button'); img.setAttribute('tabindex', '0');
  img.setAttribute('title', 'ABSOLUTE CINEMA ▶');
  var warmed = false;
  function warm() { if (warmed) return; warmed = true; Object.keys(P).forEach(function (k) { var i = new Image(); i.src = P[k].src; }); }
  img.addEventListener('pointerenter', warm); img.addEventListener('focus', warm);

  var ov = null;
  function play() {
    if (ov) return;
    warm();
    var audio = new Audio(BASE + 'life-force.mp3'); audio.preload = 'auto';
    var lp = document.querySelector('#lp-player audio'), lpWas = lp && !lp.paused;
    if (lpWas) lp.pause();

    ov = document.createElement('div'); ov.className = 'cine';
    ov.innerHTML = '<div class="cine-stage">' +
      '<div class="cine-cap"><span></span></div>' +
      '<div class="cine-view"><div class="cine-pic"><img alt=""></div>' +
        '<div class="cine-title"><b>ABSOLUTE CINEMA</b><b class="ghost" aria-hidden="true">ABSOLUTE CINEMA</b></div>' +
        '<div class="cine-grain"></div><div class="cine-vig"></div><div class="cine-flash"></div></div>' +
      '<div class="cine-bar"><i></i></div>' +
      '<button type="button" class="cine-x" aria-label="Close">&times;</button></div>';
    ov.querySelector('.cine-cap span').textContent = CAPTION;
    document.body.appendChild(ov);
    document.documentElement.classList.add('cine-lock');
    var stage = ov.querySelector('.cine-stage'), view = ov.querySelector('.cine-view'), pic = ov.querySelector('.cine-pic'), picImg = pic.querySelector('img'),
        title = ov.querySelector('.cine-title'), flash = ov.querySelector('.cine-flash'), bar = ov.querySelector('.cine-bar i');

    var H = Math.min(window.innerHeight * 0.92, window.innerWidth * 0.94 * 16 / 9), W = H * 9 / 16;
    stage.style.width = W + 'px'; stage.style.height = H + 'px'; stage.style.fontSize = (W / 360 * 16) + 'px';
    var to = { left: (window.innerWidth - W) / 2, top: (window.innerHeight - H) / 2 };
    stage.style.left = to.left + 'px'; stage.style.top = to.top + 'px';
    var fold = function () {
      var r = img.getBoundingClientRect();
      return 'translate(' + (r.left - to.left) + 'px,' + (r.top - to.top) + 'px) scale(' + (r.width / W) + ',' + (r.height / H) + ')';
    };
    if (!reduce) stage.animate([{ transform: fold(), borderRadius: '50%' }, { transform: 'none', borderRadius: '8px' }], { duration: 600, easing: 'cubic-bezier(.2,.8,.2,1)' });
    ov.animate([{ backgroundColor: 'rgba(0,0,0,0)' }, { backgroundColor: 'rgba(0,0,0,.93)' }], { duration: 450, fill: 'forwards' });

    var cur = -1, t0 = performance.now(), started = false, closing = false, raf = 0;
    audio.addEventListener('playing', function () { started = true; t0 = performance.now() - audio.currentTime * 1000; });
    var pr = audio.play(); if (pr && pr.catch) pr.catch(function () {});
    var clock = function () { return started && !audio.paused ? audio.currentTime : (performance.now() - t0) / 1000; };

    function showPic(c, dur) {
      var pp = P[c.p];
      if (picImg.getAttribute('src') !== pp.src) picImg.src = pp.src;
      picImg.style.transformOrigin = pp.face[0] + '% ' + pp.face[1] + '%';
      title.classList.remove('is-on'); pic.style.opacity = 1; pic.style.filter = '';
      if (reduce) { picImg.style.transform = 'scale(' + c.z[1] + ')'; return; }
      picImg.animate([{ transform: 'scale(' + c.z[0] + ')' }, { transform: 'scale(' + c.z[1] + ')' }], { duration: dur * 1000, easing: c.flash ? 'cubic-bezier(.1,.7,.2,1)' : 'linear', fill: 'forwards' });
      view.animate([{ transform: 'scale(1.06)' }, { transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2,.8,.3,1)' });
      flash.animate([{ opacity: c.flash ? 0.9 : 0.28 }, { opacity: 0 }], { duration: c.flash ? 380 : 140, easing: 'ease-out' });
    }
    function showTitle(c, dur) {
      pic.style.opacity = 0;
      title.classList.toggle('is-ghost', !!c.ghost);
      title.classList.remove('is-on'); void title.offsetWidth; title.classList.add('is-on');
      title.style.setProperty('--d', dur + 's');
    }
    function whip(c, dur) {
      var pp = P[c.p];
      picImg.src = pp.src; picImg.style.transformOrigin = pp.face[0] + '% ' + pp.face[1] + '%';
      title.classList.remove('is-on'); pic.style.opacity = 1;
      if (reduce) return;
      pic.animate([{ transform: 'translateY(-35%) scaleY(1.4)', filter: 'blur(14px) brightness(1.4)', opacity: 0 },
                   { transform: 'translateY(8%) scaleY(1.15)', filter: 'blur(10px)', opacity: 1, offset: 0.6 },
                   { transform: 'none', filter: 'blur(4px)', opacity: 1 }], { duration: dur * 1000, easing: 'cubic-bezier(.4,0,.6,1)' });
      picImg.animate([{ transform: 'scale(1.6)' }, { transform: 'scale(1.5)' }], { duration: dur * 1000, fill: 'forwards' });
    }
    function step(i) {
      var c = CUTS[i], next = CUTS[i + 1] ? CUTS[i + 1].t : END, dur = Math.max(0.2, next - c.t);
      if (c.kind === 'pic') showPic(c, dur);
      else if (c.kind === 'title') showTitle(c, dur);
      else if (c.kind === 'whip') whip(c, dur);
      else if (c.kind === 'end') close();
    }
    function tick() {
      raf = 0; if (closing) return;
      var t = clock();
      var i = cur; while (i + 1 < CUTS.length && t >= CUTS[i + 1].t) i++;
      if (i !== cur) { cur = i; step(i); }
      bar.style.transform = 'scaleX(' + Math.min(1, t / END) + ')';
      if (!closing) raf = requestAnimationFrame(tick);
    }
    function close() {
      if (closing) return; closing = true; cancelAnimationFrame(raf);
      var v0 = audio.volume, tf = performance.now();
      (function fade() { var k = Math.min(1, (performance.now() - tf) / 700); audio.volume = v0 * (1 - k); if (k < 1) requestAnimationFrame(fade); else audio.pause(); })();
      var done = function () { if (ov) ov.remove(); ov = null; document.documentElement.classList.remove('cine-lock'); document.removeEventListener('keydown', key); if (lpWas) lp.play().catch(function () {}); img.focus({ preventScroll: true }); };
      if (reduce) { done(); return; }
      ov.animate([{ backgroundColor: 'rgba(0,0,0,.93)' }, { backgroundColor: 'rgba(0,0,0,0)' }], { duration: 650, fill: 'forwards' });
      stage.animate([{ transform: 'none', borderRadius: '8px' }, { transform: fold(), borderRadius: '50%' }],
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
