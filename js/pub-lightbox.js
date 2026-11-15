// Click a publication figure to see it large. Esc, the × or a click anywhere closes it.
(function () {
  var box = null, lastFocus = null;

  function close() {
    if (!box) return;
    var b = box;
    box = null;
    b.classList.remove('open');
    document.documentElement.style.overflow = '';
    setTimeout(function () { b.remove(); }, 200);
    if (lastFocus) lastFocus.focus();
  }

  function open(img) {
    close();
    lastFocus = document.activeElement;
    var card = img.closest('.pub-card');
    var t = card && card.querySelector('.pub-title-bar');
    box = document.createElement('div');
    box.className = 'pub-lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Enlarged figure');
    var big = document.createElement('img');
    big.src = img.currentSrc || img.src;
    big.alt = img.alt || '';
    var x = document.createElement('button');
    x.type = 'button';
    x.setAttribute('aria-label', 'Close');
    x.textContent = '×';
    box.appendChild(x);
    box.appendChild(big);
    if (t && !t.classList.contains('sealed-title')) {
      var cap = document.createElement('p');
      cap.textContent = t.textContent.trim();
      box.appendChild(cap);
    }
    box.addEventListener('click', close);
    document.body.appendChild(box);
    document.documentElement.style.overflow = 'hidden';
    requestAnimationFrame(function () { if (box) box.classList.add('open'); });
    x.focus();
  }

  // add the "Click to enlarge" chip to every real figure (also ones revealed later by unlocking)
  function hint(root) {
    (root || document).querySelectorAll('.pub-figure img.pub-card-img:not(.sealed-img)').forEach(function (img) {
      var fig = img.closest('.pub-figure');
      if (fig.querySelector('.pub-zoom-hint')) return;
      var h = document.createElement('span');
      h.className = 'pub-zoom-hint';
      h.textContent = 'Click to enlarge';
      fig.appendChild(h);
      img.setAttribute('tabindex', '0');
      img.setAttribute('role', 'button');
    });
  }

  document.addEventListener('click', function (e) {
    var img = e.target.closest && e.target.closest('.pub-figure img.pub-card-img:not(.sealed-img)');
    if (!img || img.closest('.pub-peek')) return;
    e.preventDefault();
    open(img);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
    else if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.pub-figure img.pub-card-img:not(.sealed-img)')) {
      e.preventDefault();
      open(e.target);
    }
  });

  function init() {
    hint();
    // unlocked cards get their real figure later
    new MutationObserver(function () { hint(); }).observe(document.querySelector('.pub-grid') || document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
