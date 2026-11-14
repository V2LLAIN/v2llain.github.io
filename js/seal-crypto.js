// Shared by the homepage (unlock) and /seal/ (lock).
// A sealed paper is one JSON file: { v, kdf, iter, salt, iv, ct } — AES-256-GCM, key from PBKDF2-SHA256(passphrase).
// Nothing readable is stored in the repo; only someone with the passphrase can turn `ct` back into the paper.
(function (root) {
  var ITER = 600000;
  var enc = new TextEncoder(), dec = new TextDecoder();

  function b64(buf) {
    var bytes = new Uint8Array(buf), s = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }
  function unb64(str) {
    var s = atob(str), out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  function deriveKey(pass, salt, iter, usage) {
    return crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' },
        base, { name: 'AES-GCM', length: 256 }, false, [usage]);
    });
  }

  // obj -> sealed record
  function seal(obj, pass) {
    var salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    return deriveKey(pass, salt, ITER, 'encrypt').then(function (key) {
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, enc.encode(JSON.stringify(obj)));
    }).then(function (ct) {
      return { v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
    });
  }

  // sealed record -> obj   (rejects on a wrong passphrase)
  function open(rec, pass) {
    if (!rec || rec.v !== 1) return Promise.reject(new Error('Unknown sealed format'));
    return deriveKey(pass, unb64(rec.salt), rec.iter, 'decrypt').then(function (key) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.iv) }, key, unb64(rec.ct));
    }).then(function (pt) { return JSON.parse(dec.decode(pt)); });
  }

  // Summary text may use **bold**, *italic* and a few inline tags; everything else is dropped.
  var ALLOWED = { STRONG: 1, B: 1, EM: 1, I: 1, SUP: 1, SUB: 1, BR: 1, CODE: 1 };
  function safeInline(text) {
    var html = String(text || '')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/\n/g, '<br>');
    var tpl = document.createElement('template');
    tpl.innerHTML = html;
    (function clean(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (c) {
        if (c.nodeType === 1) {
          clean(c);
          if (!ALLOWED[c.tagName]) { while (c.firstChild) node.insertBefore(c.firstChild, c); node.removeChild(c); }
          else while (c.attributes.length) c.removeAttribute(c.attributes[0].name);
        } else if (c.nodeType !== 3) node.removeChild(c);
      });
    })(tpl.content);
    return tpl.innerHTML;
  }

  root.SealCrypto = { seal: seal, open: open, safeInline: safeInline };
})(window);
