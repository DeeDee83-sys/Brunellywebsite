/**
 * brunelly-nav-a11y.js — Mobile navigation accessibility helpers
 * Story 42: keyboard dismissal, focus management, ARIA sync
 */
(function () {
  'use strict';

  var drawer = document.getElementById('mobile-nav');
  var hamburger = document.getElementById('nav-hamburger');
  if (!drawer || !hamburger) return;

  function closeDrawer() {
    if (!drawer.classList.contains('open')) return;
    drawer.classList.remove('open');
    hamburger.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.focus();
  }

  // Escape key closes drawer
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer.classList.contains('open')) {
      e.preventDefault();
      closeDrawer();
    }
  });

  // Click outside closes drawer
  document.addEventListener('click', function (e) {
    if (!drawer.classList.contains('open')) return;
    if (!drawer.contains(e.target) && !hamburger.contains(e.target)) {
      closeDrawer();
    }
  });

  // Focus trap inside drawer when open
  drawer.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var focusables = drawer.querySelectorAll(
      'a[href], button, [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
})();
