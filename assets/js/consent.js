(function () {
  var GA_ID = 'G-YE6B6QRM36';
  var CLARITY_ID = 't7ikzv22yu';
  var _analyticsLoaded = false;

  function loadAnalytics() {
    if (_analyticsLoaded) return;
    _analyticsLoaded = true;

    // Google Analytics
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_ID);

    // Microsoft Clarity
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', CLARITY_ID);
  }

  function showBanner() {
    var banner = document.getElementById('cookie-banner');
    if (banner) banner.style.display = 'flex';
  }

  window.setCookieConsent = function (level) {
    localStorage.setItem('brunelly_cookie_consent', level);
    localStorage.setItem('brunelly_cookie_date', new Date().toISOString());
    var banner = document.getElementById('cookie-banner');
    if (banner) banner.style.display = 'none';
    if (level === 'all') loadAnalytics();
  };

  var consent = localStorage.getItem('brunelly_cookie_consent');
  if (consent === 'all') {
    loadAnalytics();
  } else if (!consent) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showBanner);
    } else {
      showBanner();
    }
  }
})();
