/* ==========================================================================
   Csodabogár Fejlesztő Műhely · site.js (függőség nélkül, defer-rel töltődik)
   Modulok:
     1. Mobil menü           [aria-controls="mobil-menu"]
     2. Hiányzó adatok        mark.todo elrejtése: #tiszta hash vagy [data-todo-toggle] gomb
     3. Programszűrő          [data-filter-group] gombok + [data-filter-items] > [data-tags]
     4. Lightbox              [data-lightbox] csoport > [data-lightbox-item] gombok
     5. GYIK                  hash alapján nyitja a megfelelő <details>-t
     6. Virág nyílás          .js-bloom (IntersectionObserver)
     7. Űrlapok               form[data-demo-form] (validáció; data-endpoint esetén POST JSON az /api/kapcsolat-ra)
     8. Ragadós szűrősáv      [data-sticky] árnyéka, amikor "odaragad"
   ========================================================================== */
(function () {
  'use strict';
  var d = document;
  var root = d.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(sel, ctx) { return (ctx || d).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || d).querySelectorAll(sel)); }
  function store(key, val) {
    try {
      if (val === undefined) return window.localStorage.getItem(key);
      if (val === null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, val);
    } catch (e) { return null; }
    return null;
  }
  function icon(name) {
    var paths = {
      x: '<path d="M6 6l12 12M18 6L6 18"/>',
      nyil: '<path d="M4 12h15M13 6l6 6-6 6"/>'
    };
    return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + paths[name] + '</svg>';
  }

  /* ---------- 1. Mobil menü ---------- */
  function initMenu() {
    var btn = $('.menu-toggle');
    var panel = $('#mobil-menu');
    if (!btn || !panel) return;
    var label = $('.menu-toggle__label', btn);

    function focusables() { return $$('a[href], button:not([disabled])', panel).filter(function (el) { return el.offsetParent !== null; }); }
    function setOpen(open, returnFocus) {
      btn.setAttribute('aria-expanded', String(open));
      panel.classList.toggle('is-open', open);
      root.classList.toggle('menu-open', open);
      if (label) label.textContent = open ? 'Bezárás' : 'Menü';
      if (open) {
        var first = $('[aria-current="page"]', panel) || focusables()[0];
        if (first) first.focus();
      } else if (returnFocus) {
        btn.focus();
      }
    }
    btn.addEventListener('click', function () { setOpen(btn.getAttribute('aria-expanded') !== 'true'); });
    d.addEventListener('keydown', function (e) {
      if (!panel.classList.contains('is-open')) return;
      if (e.key === 'Escape') { setOpen(false, true); return; }
      if (e.key === 'Tab') {
        // fókusz a menüben és a menügombon marad
        var items = [btn].concat(focusables());
        var i = items.indexOf(d.activeElement);
        if (e.shiftKey && (i <= 0)) { e.preventDefault(); items[items.length - 1].focus(); }
        else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
      }
    });
    panel.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 1080 && panel.classList.contains('is-open')) setOpen(false);
    });
  }

  /* ---------- 2. Hiányzó adatok (sárga cetlik) elrejtése ---------- */
  function initTodos() {
    var KEY = 'csodabogar-todos-hidden';
    var buttons = $$('[data-todo-toggle]');
    function apply(hidden) {
      d.body.classList.toggle('todos-hidden', hidden);
      buttons.forEach(function (b) {
        b.setAttribute('aria-pressed', String(hidden));
        var l = $('[data-todo-toggle-label]', b);
        if (l) l.textContent = hidden ? 'Hiányzó adatok mutatása' : 'Hiányzó adatok elrejtése';
      });
    }
    // Éles (saját) domainen a sárga cetlik mindig rejtve vannak, a kapcsoló gomb is.
    // Előnézeten (localhost, *.vercel.app, claude.ai) látszanak, hogy Margaréta lássa, mi hiányzik.
    var h = location.hostname;
    var isPreview = !h || h === 'localhost' || h === '127.0.0.1' || /\.vercel\.app$/.test(h) || /claude/.test(h) || /^\d+\.\d+\.\d+\.\d+$/.test(h);
    if (!isPreview) {
      d.body.classList.add('todos-hidden', 'is-production');
      buttons.forEach(function (b) { b.hidden = true; });
      return;
    }
    var fromHash = location.hash === '#tiszta';
    apply(fromHash || store(KEY) === '1');
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        var hidden = !d.body.classList.contains('todos-hidden');
        apply(hidden);
        store(KEY, hidden ? '1' : null);
      });
    });
    window.addEventListener('hashchange', function () { if (location.hash === '#tiszta') apply(true); });
  }

  /* ---------- 3. Programszűrő ---------- */
  function initFilter() {
    $$('[data-filter-group]').forEach(function (group) {
      var list = d.getElementById(group.getAttribute('data-filter-group'));
      if (!list) return;
      var items = $$('[data-tags]', list);
      var count = $('[data-filter-count]');
      var empty = $('[data-filter-empty]');
      var buttons = $$('[data-filter]', group);
      function run(tag) {
        var shown = 0;
        items.forEach(function (it) {
          var ok = tag === 'mind' || (' ' + it.getAttribute('data-tags') + ' ').indexOf(' ' + tag + ' ') > -1;
          it.hidden = !ok;
          if (ok) shown++;
        });
        buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-filter') === tag)); });
        if (count) count.textContent = shown + ' program' + (tag === 'mind' ? '' : ' a választott csoportnak');
        if (empty) empty.hidden = shown > 0;
      }
      buttons.forEach(function (b) {
        b.addEventListener('click', function () { run(b.getAttribute('data-filter')); });
      });
    });
  }

  /* ---------- 4. Lightbox (natív <dialog>) ---------- */
  function initLightbox() {
    var groups = $$('[data-lightbox]');
    if (!groups.length || typeof HTMLDialogElement === 'undefined') return;
    var dlg = d.createElement('dialog');
    dlg.className = 'lightbox';
    dlg.setAttribute('aria-label', 'Képnézegető');
    dlg.innerHTML =
      '<p class="lightbox__count" aria-live="polite"></p>' +
      '<figure class="lightbox__frame"><div class="lightbox__media"></div><figcaption class="lightbox__cap"></figcaption></figure>' +
      '<button class="lightbox__btn lightbox__close" type="button" aria-label="Bezárás">' + icon('x') + '</button>' +
      '<button class="lightbox__btn lightbox__prev" type="button" aria-label="Előző kép">' + icon('nyil') + '</button>' +
      '<button class="lightbox__btn lightbox__next" type="button" aria-label="Következő kép">' + icon('nyil') + '</button>';
    d.body.appendChild(dlg);
    var media = $('.lightbox__media', dlg), cap = $('.lightbox__cap', dlg), counter = $('.lightbox__count', dlg);
    var current = [], index = 0, opener = null;

    function show(i) {
      index = (i + current.length) % current.length;
      var item = current[index];
      var visual = $('img, .photo-placeholder', item);
      media.innerHTML = '';
      if (visual) {
        var clone = visual.cloneNode(true);
        if (clone.tagName === 'IMG') {
          clone.removeAttribute('loading');
          clone.removeAttribute('sizes');
          if (item.getAttribute('data-full')) { clone.src = item.getAttribute('data-full'); clone.removeAttribute('srcset'); }
        }
        media.appendChild(clone);
      }
      cap.textContent = item.getAttribute('data-caption') || (visual && visual.getAttribute('alt')) || '';
      counter.textContent = (index + 1) + '. kép / ' + current.length;
    }
    groups.forEach(function (g) {
      var items = $$('[data-lightbox-item]', g);
      items.forEach(function (it, i) {
        it.addEventListener('click', function (e) {
          e.preventDefault();
          current = items.filter(function (x) { return !x.closest('[hidden]'); });
          opener = it;
          dlg.showModal();
          show(current.indexOf(it));
        });
      });
    });
    $('.lightbox__close', dlg).addEventListener('click', function () { dlg.close(); });
    $('.lightbox__prev', dlg).addEventListener('click', function () { show(index - 1); });
    $('.lightbox__next', dlg).addEventListener('click', function () { show(index + 1); });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') show(index - 1);
      if (e.key === 'ArrowRight') show(index + 1);
    });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); }); // háttérre kattintás
    dlg.addEventListener('close', function () { if (opener) opener.focus(); });
  }

  /* ---------- 5. GYIK: a hash-re mutató kérdés nyitva ---------- */
  function initFaq() {
    function openFromHash() {
      if (!location.hash || location.hash.length < 2) return;
      var el;
      try { el = d.querySelector(location.hash); } catch (e) { return; }
      if (el && el.tagName === 'DETAILS') el.open = true;
    }
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
  }

  /* ---------- 6. MOZAIK virág nyílása ---------- */
  function initBloom() {
    var flowers = $$('.js-bloom');
    if (!flowers.length) return;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      flowers.forEach(function (f) { f.classList.add('is-open'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-open'); io.unobserve(en.target); }
      });
    }, { threshold: 0.45 });
    flowers.forEach(function (f) { io.observe(f); });
  }

  /* ---------- 7. Bemutató űrlapok ----------
     <form data-demo-form data-require-one="telefon,email"> ... <div class="field"> <label> <input required> </div>
     Opcionális: data-msg-missing (mezőn), data-error (minta / e-mail hiba), data-require-one-msg és data-success="<template id>" (formon).
     A ?program=<slug> URL-paraméter előválasztja a select[name="program"] / input[name="program"][value=<slug>] mezőt. */
  function initForms() {
    var params = new URLSearchParams(location.search);
    var preset = params.get('program');
    $$('form[data-demo-form]').forEach(function (form) {
      form.setAttribute('novalidate', '');
      var tf = form.querySelector('[data-form-time]');
      if (tf) tf.value = String(Date.now());
      if (preset) {
        var sel = form.querySelector('select[name="program"]');
        if (sel) sel.value = preset;
        $$('input[name="program"]', form).forEach(function (inp) { if (inp.value === preset) inp.checked = true; });
      }
      function fieldOf(el) { return el.closest('.field') || el.parentElement; }
      function setError(el, msg) {
        var f = fieldOf(el);
        var err = $('.field__error', f);
        if (msg) {
          if (!err) {
            err = d.createElement('p');
            err.className = 'field__error';
            err.id = (el.id || el.name) + '-hiba';
            f.appendChild(err);
          }
          err.textContent = msg;
          el.setAttribute('aria-invalid', 'true');
          var db = (el.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
          if (db.indexOf(err.id) < 0) { db.push(err.id); el.setAttribute('aria-describedby', db.join(' ')); }
        } else {
          if (err) err.remove();
          el.removeAttribute('aria-invalid');
        }
      }
      function messageFor(el) {
        if (el.validity.valueMissing) return el.getAttribute('data-msg-missing') || (el.type === 'checkbox' ? 'Kérjük, jelölje be.' : 'Kérjük, töltse ki ezt a mezőt.');
        if (el.validity.typeMismatch && el.type === 'email') return el.getAttribute('data-error') || 'Kérjük, valós e-mail-címet adjon meg (pl. nev@pelda.hu).';
        if (el.validity.patternMismatch) return el.getAttribute('data-error') || 'Kérjük, ellenőrizze a formátumot.';
        return el.validationMessage;
      }
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var invalid = [];
        $$('input, select, textarea', form).forEach(function (el) {
          if (el.type === 'hidden' || el.disabled) return;
          var bad = !el.checkValidity();
          setError(el, bad ? messageFor(el) : '');
          if (bad) invalid.push(el);
        });
        var one = form.getAttribute('data-require-one');
        if (one) {
          var names = one.split(',');
          var els = names.map(function (n) { return form.elements[n.trim()]; }).filter(Boolean);
          var any = els.some(function (el) { return el.value.trim() !== ''; });
          if (!any && els[0]) { setError(els[0], form.getAttribute('data-require-one-msg') || 'Adjon meg telefonszámot vagy e-mail-címet, hogy vissza tudjuk hívni.'); invalid.push(els[0]); invalid.sort(function (x, y) { return x.compareDocumentPosition(y) & 4 ? -1 : 1; }); }
        }
        if (invalid.length) { invalid[0].focus(); return; }
        var endpoint = form.getAttribute('data-endpoint');
        if (endpoint && !isDemoHost()) { send(endpoint); return; }
        showSuccess(!endpoint || isDemoHost());
      });
      function isDemoHost() { return /claude/.test(location.hostname); }
      function collect() {
        var data = {};
        $$('input, select, textarea', form).forEach(function (el) {
          if (!el.name || el.disabled) return;
          if (el.type === 'checkbox') {
            if (el.name === 'adatkezeles') { data[el.name] = el.checked; return; }
            if (!data[el.name]) data[el.name] = [];
            if (el.checked) data[el.name].push(el.value);
            return;
          }
          if (el.type === 'radio') { if (el.checked) data[el.name] = el.value; return; }
          data[el.name] = el.value.trim();
        });
        data.oldal = location.pathname;
        return data;
      }
      function showError(msg) {
        var box = $('.form-send-error', form);
        if (!box) {
          box = d.createElement('div');
          box.className = 'form-send-error';
          box.setAttribute('role', 'alert');
          var btn = $('[type="submit"]', form);
          btn.parentNode.insertBefore(box, btn);
        }
        box.innerHTML = '<p><strong>Most nem sikerült elküldeni az üzenetet.</strong> ' + (msg || 'Kérjük, próbálja újra pár perc múlva, vagy hívjon minket: <a href="tel:+36306325350">+36 30 632 5350</a>, illetve írjon: <a href="mailto:tataifejlesztes@gmail.com">tataifejlesztes@gmail.com</a>.') + '</p>';
        box.focus && box.setAttribute('tabindex', '-1');
        box.focus();
      }
      function send(endpoint) {
        var btn = $('[type="submit"]', form);
        var label = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Küldés folyamatban…'; }
        fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(collect()) })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, body: j }; }); })
          .then(function (res) {
            if (res.ok && res.body && res.body.ok) { showSuccess(false); return; }
            showError(res.body && res.body.uzenet);
          })
          .catch(function () { showError(); })
          .then(function () { if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.innerHTML = label; } });
      }
      function showSuccess(demo) {
        var card = d.createElement('div');
        card.className = 'form-success';
        card.setAttribute('role', 'status');
        card.setAttribute('tabindex', '-1');
        var tpl = form.getAttribute('data-success') && d.getElementById(form.getAttribute('data-success'));
        card.innerHTML = tpl ? tpl.innerHTML :
          '<img src="assets/svg/kabala-ulo.svg" alt="" width="120" height="122">' +
          '<h3>Köszönjük! Hamarosan keressük.</h3>' +
          '<p>Megkaptuk az üzenetét. Hamarosan jelentkezünk a megadott elérhetőségen, és megbeszéljük a következő lépést.</p>' +
          '';
        if (demo) card.insertAdjacentHTML('beforeend', '<p class="form-success__demo">Ez egy előnézet, innen az üzenet nem kerül elküldésre.</p>');
        form.hidden = true;
        form.parentNode.insertBefore(card, form.nextSibling);
        card.focus();
      }
      form.addEventListener('input', function (e) {
        if (e.target.getAttribute('aria-invalid') === 'true' && e.target.checkValidity()) setError(e.target, '');
      });
    });
  }

  /* ---------- 8. Ragadós szűrősáv árnyéka ---------- */
  function initSticky() {
    $$('[data-sticky]').forEach(function (bar) {
      if (!('IntersectionObserver' in window)) return;
      var sentinel = d.createElement('div');
      sentinel.setAttribute('aria-hidden', 'true');
      sentinel.style.height = '1px';
      bar.parentNode.insertBefore(sentinel, bar);
      new IntersectionObserver(function (en) {
        bar.classList.toggle('is-stuck', !en[0].isIntersecting && en[0].boundingClientRect.top < 120);
      }, { rootMargin: '-90px 0px 0px 0px' }).observe(sentinel);
    });
  }

  function init() {
    initMenu(); initTodos(); initFilter(); initLightbox(); initFaq(); initBloom(); initForms(); initSticky();
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init); else init();
})();

/* ==========================================================================
   Rólunk / Galéria / Kapcsolat kiegészítések (C)
     9.  Másolás gomb         button[data-copy="szöveg"] (+ data-copy-target="<id>", [data-copy-label])
                               navigator.clipboard, hiba esetén execCommand, végül a szöveg kijelölése
     10. Galéria számláló     [data-gallery-count="<lista id>"]: "N kép" a szűrés után
     11. Lightbox fókusz      Tab / Shift+Tab a nyitott dialog.lightbox gombjai között marad
   ========================================================================== */
(function () {
  'use strict';
  var d = document;
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || d).querySelectorAll(sel)); }

  var live;
  function announce(msg) {
    if (!live) {
      live = d.createElement('p');
      live.className = 'visually-hidden';
      live.setAttribute('role', 'status');
      live.setAttribute('aria-live', 'polite');
      d.body.appendChild(live);
    }
    live.textContent = '';
    setTimeout(function () { live.textContent = msg; }, 30);
  }

  /* ---------- 9. Másolás gomb ---------- */
  function initCopy() {
    $$('button[data-copy]').forEach(function (btn) {
      var label = btn.querySelector('[data-copy-label]');
      var original = label ? label.textContent : '';
      var timer;
      function feedback(text, ok) {
        if (label) label.textContent = text;
        btn.classList.toggle('is-copied', ok);
        btn.classList.toggle('is-selected', !ok);
        clearTimeout(timer);
        timer = setTimeout(function () {
          if (label) label.textContent = original;
          btn.classList.remove('is-copied', 'is-selected');
        }, 2600);
      }
      function selectTarget() {
        var target = d.getElementById(btn.getAttribute('data-copy-target') || '');
        if (!target || !window.getSelection) return false;
        try {
          var range = d.createRange();
          range.selectNodeContents(target);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          return true;
        } catch (e) { return false; }
      }
      function fallback() {
        var selected = selectTarget();
        var copied = false;
        if (selected) {
          try { copied = d.execCommand && d.execCommand('copy'); } catch (e) { copied = false; }
        }
        if (copied) {
          feedback('Kimásolva!', true);
          announce('Kimásolva a vágólapra: ' + btn.getAttribute('data-copy'));
        } else {
          feedback('Kijelölve, másolható', false);
          announce('A szöveget kijelöltük, a Ctrl+C (Macen Cmd+C) billentyűkkel másolhatja.');
        }
      }
      btn.addEventListener('click', function () {
        var text = btn.getAttribute('data-copy');
        try {
          if (navigator.clipboard && window.isSecureContext !== false) {
            navigator.clipboard.writeText(text).then(function () {
              feedback('Kimásolva!', true);
              announce('Kimásolva a vágólapra: ' + text);
            }, fallback);
            return;
          }
        } catch (e) { /* lent a tartalék megoldás */ }
        fallback();
      });
    });
  }

  /* ---------- 10. Galéria képszámláló ---------- */
  function initGalleryCount() {
    $$('[data-gallery-count]').forEach(function (out) {
      var list = d.getElementById(out.getAttribute('data-gallery-count'));
      var group = d.querySelector('[data-filter-group="' + out.getAttribute('data-gallery-count') + '"]');
      if (!list || !group) return;
      function update() {
        var shown = $$('[data-tags]', list).filter(function (li) { return !li.hidden; }).length;
        out.textContent = shown + ' kép';
      }
      // a core szűrő (3.) előbb fut, mert korábban iratkozott fel
      $$('[data-filter]', group).forEach(function (b) { b.addEventListener('click', update); });
      update();
    });
  }

  /* ---------- 11. Lightbox fókuszcsapda (a natív modal mellé, hogy a böngésző-felületre se lépjen ki) ---------- */
  function initLightboxTrap() {
    d.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var dlg = d.querySelector('dialog.lightbox[open]');
      if (!dlg) return;
      var items = $$('button', dlg).filter(function (b) { return !b.disabled && b.offsetParent !== null; });
      if (!items.length) return;
      var i = items.indexOf(d.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
      else if (!e.shiftKey && (i === items.length - 1 || i < 0)) { e.preventDefault(); items[0].focus(); }
    });
  }

  function init() { initCopy(); initGalleryCount(); initLightboxTrap(); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init); else init();
})();
