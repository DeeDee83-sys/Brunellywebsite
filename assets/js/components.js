(function () {
  var path = window.location.pathname.replace(/\/$/, '') || '/';

  function isActive(href) {
    if (href === '/') return path === '' || path === '/' || path === '/index';
    return path === href || path.startsWith(href + '/') || path.startsWith(href + '#');
  }

  function navLink(href, label, extraClass) {
    var cls = isActive(href) ? 'active' : '';
    if (extraClass) cls = (cls + ' ' + extraClass).trim();
    return '<a href="' + href + '"' + (cls ? ' class="' + cls + '"' : '') + '>' + label + '</a>';
  }

  var header = [
    '<nav>',
    '  <a href="/" class="nav-logo"><img src="/assets/images/logo-brunelly.webp" alt="Brunelly" /></a>',
    '  <ul class="nav-links">',
    '    <li>' + navLink('/', 'Home') + '</li>',
    '    <li>' + navLink('/features/features-hub', 'Features') + '</li>',
    '    <li>' + navLink('/pricing', 'Pricing') + '</li>',
    '    <li class="nav-dropdown">',
    '      ' + navLink('/resources', 'Resources'),
    '      <ul class="nav-dropdown-menu">',
    '        <li><a href="/resources#articles">Articles</a></li>',
    '        <li><a href="/resources#videos">Videos</a></li>',
    '      </ul>',
    '    </li>',
    '    <li>' + navLink('/contact', 'Contact') + '</li>',
    '  </ul>',
    '  <div class="nav-actions">',
    '    <a href="https://calendly.com/vinoj-pinavida/30min" class="btn-ghost" target="_blank" rel="noopener noreferrer">Talk to an expert</a>',
    '    <a href="https://app.brunelly.com/register" class="btn-primary">Sign in</a>',
    '  </div>',
    '  <button class="nav-hamburger" id="nav-hamburger" onclick="var n=document.getElementById(\'mobile-nav\');var h=document.getElementById(\'nav-hamburger\');n.classList.toggle(\'open\');h.classList.toggle(\'open\');h.setAttribute(\'aria-expanded\',n.classList.contains(\'open\'));n.setAttribute(\'aria-hidden\',!n.classList.contains(\'open\'));" aria-label="Toggle menu" aria-expanded="false" aria-controls="mobile-nav">',
    '    <span></span><span></span><span></span>',
    '  </button>',
    '</nav>',
    '<div class="mobile-nav" id="mobile-nav" role="dialog" aria-modal="true" aria-label="Mobile menu" aria-hidden="true">',
    '  ' + navLink('/', 'Home'),
    '  ' + navLink('/features/features-hub', 'Features'),
    '  ' + navLink('/pricing', 'Pricing'),
    '  ' + navLink('/contact', 'Contact'),
    '  <div class="mobile-nav-group">',
    '    <button class="mobile-nav-group-toggle" onclick="var s=this.nextElementSibling;s.classList.toggle(\'open\');this.classList.toggle(\'open\');this.setAttribute(\'aria-expanded\',s.classList.contains(\'open\'));" aria-expanded="false" aria-controls="mobile-nav-sub-resources">Resources</button>',
    '    <div class="mobile-nav-sub" id="mobile-nav-sub-resources">',
    '      <a href="/resources#articles">Articles</a>',
    '      <a href="/resources#videos">Videos</a>',
    '    </div>',
    '  </div>',
    '  <a href="https://calendly.com/vinoj-pinavida/30min" class="mobile-nav-cta" target="_blank" rel="noopener noreferrer">Talk to an expert</a>',
    '</div>'
  ].join('\n');

  var footer = [
    '<footer>',
    '  <a href="/" class="footer-logo"><img src="/assets/images/showcase-brunelly-2.webp" alt="Brunelly" /></a>',
    '  <div class="footer-cols">',
    '    <div class="footer-col">',
    '      <h4>Product</h4>',
    '      <a href="/features/features-hub">Features</a>',
    '      <a href="/pricing">Pricing</a>',
    '      <a href="/resources">Resources</a>',
    '    </div>',
    '    <div class="footer-col">',
    '      <h4>Company</h4>',
    '      <a href="/contact">Contact</a>',
    '      <a href="/privacy">Privacy Policy</a>',
    '      <a href="/cookies">Cookie Policy</a>',
    '      <a href="/terms">Terms of Service</a>',
    '    </div>',
    '    <div class="footer-col">',
    '      <h4>Community</h4>',
    '      <a href="https://www.linkedin.com/company/brunelly/" target="_blank">LinkedIn</a>',
    '      <a href="https://x.com/BrunellyAI" target="_blank">X / Twitter</a>',
    '      <a href="https://www.reddit.com/r/Brunelly/" target="_blank">Reddit</a>',
    '      <a href="https://discord.gg/cWfNSXzQjr" target="_blank">Discord</a>',
    '      <a href="https://medium.com/@dhilushi_perusinghe" target="_blank">Medium</a>',
    '    </div>',
    '  </div>',
    '  <div class="footer-right">',
    '    <div class="footer-socials">',
    '      <a href="https://www.linkedin.com/company/brunelly/" target="_blank" class="social-btn" title="LinkedIn"><img src="/assets/icons/linkedin.svg" alt="LinkedIn"></a>',
    '      <a href="https://x.com/BrunellyAI" target="_blank" class="social-btn" title="X / Twitter"><img src="/assets/icons/x.svg" alt="X"></a>',
    '      <a href="https://www.reddit.com/r/Brunelly/" target="_blank" class="social-btn" title="Reddit"><img src="/assets/icons/reddit.svg" alt="Reddit"></a>',
    '      <a href="https://discord.gg/cWfNSXzQjr" target="_blank" class="social-btn" title="Discord"><img src="/assets/icons/discord.svg" alt="Discord"></a>',
    '      <a href="https://medium.com/@dhilushi_perusinghe" target="_blank" class="social-btn" title="Medium"><img src="/assets/icons/medium.svg" alt="Medium"></a>',
    '    </div>',
    '    <div class="footer-policy">',
    '      <a href="/privacy">Privacy</a>',
    '      <a href="/cookies">Cookies</a>',
    '      <a href="/terms">Terms</a>',
    '    </div>',
    '    <div class="footer-copy">&#169; 2026 Brunelly. All Rights Reserved.</div>',
    '  </div>',
    '</footer>'
  ].join('\n');

  var headerEl = document.getElementById('site-header');
  if (headerEl) headerEl.outerHTML = header;

  // Click-based dropdown (nav is in DOM immediately after outerHTML replacement)
  var dropdown = document.querySelector('.nav-dropdown');
  if (dropdown) {
    var trigger = dropdown.querySelector('a');
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      dropdown.classList.toggle('open');
    });
    document.addEventListener('click', function (e) {
      if (!dropdown.contains(e.target)) dropdown.classList.remove('open');
    });
  }

  var footerEl = document.getElementById('site-footer');
  if (footerEl) footerEl.outerHTML = footer;
})();
