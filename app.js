/* ============================================
   FORGE — SPA Controller
   ============================================ */

(function () {
  'use strict';

  var STORAGE_KEY = 'forge_last_view';

  var views    = document.querySelectorAll('.view');
  var navItems = document.querySelectorAll('.nav-item');

  var currentView = getStoredView();

  /* ── Navigation ─────────────────────────── */

  function switchView(name) {
    if (name === currentView) return;

    views.forEach(function (v) { v.classList.remove('active'); });
    navItems.forEach(function (n) { n.classList.remove('active'); });

    var target = document.getElementById('view-' + name);
    var nav    = document.querySelector('[data-view="' + name + '"]');

    if (target && nav) {
      target.classList.add('active');
      nav.classList.add('active');
      currentView = name;
      storeView(name);

      var scroll = target.querySelector('.view-scroll');
      if (scroll) scroll.scrollTop = 0;

      /* refresh profile analytics on every visit */
      if (name === 'profile' && window.ForgeProfile) {
        window.ForgeProfile.refresh();
      }
    }
  }

  navItems.forEach(function (item) {
    item.addEventListener('click', function () {
      switchView(this.dataset.view);
    });
  });

  /* ── Chart Toggle ──────────────────────── */

  document.querySelectorAll('.toggle-btn[data-chart]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      this.closest('.chart-toggle').querySelectorAll('.toggle-btn').forEach(function (b) {
        b.classList.remove('active');
      });
      this.classList.add('active');
    });
  });

  /* ── Storage ───────────────────────────── */

  function storeView(name) {
    try { localStorage.setItem(STORAGE_KEY, name); } catch (e) {}
  }

  function getStoredView() {
    try { return localStorage.getItem(STORAGE_KEY) || 'workout'; } catch (e) { return 'workout'; }
  }

  /* ── Stat Bar Animation ────────────────── */

  function animateStatBars() {
    document.querySelectorAll('.stat-bar-fill').forEach(function (bar) {
      var w = bar.style.width;
      bar.style.width = '0%';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { bar.style.width = w; });
      });
    });
  }

  /* ── Keyboard Navigation ───────────────── */

  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === '1') switchView('workout');
    if (e.key === '2') switchView('progress');
    if (e.key === '3') switchView('profile');
  });

  /* ── Swipe Gestures (mobile) ───────────── */

  var txStart = 0;
  var tyStart = 0;

  document.addEventListener('touchstart', function (e) {
    txStart = e.changedTouches[0].screenX;
    tyStart = e.changedTouches[0].screenY;
  }, { passive: true });

  document.addEventListener('touchend', function (e) {
    var dx = e.changedTouches[0].screenX - txStart;
    var dy = e.changedTouches[0].screenY - tyStart;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 80 && Math.abs(dy) < 60) {
      var order = ['workout', 'progress', 'profile'];
      var idx = order.indexOf(currentView);

      if (dx < 0 && idx < order.length - 1) switchView(order[idx + 1]);
      else if (dx > 0 && idx > 0) switchView(order[idx - 1]);
    }
  }, { passive: true });

  /* ── Expose globally for logger ────────── */

  window.ForgeApp = { switchView: switchView };

  /* ── Boot ──────────────────────────────── */

  switchView(currentView);
  requestAnimationFrame(animateStatBars);

})();
