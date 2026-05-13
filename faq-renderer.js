// ════════════════════════════════════════════════════════════════
// BRUNELLY — Safe FAQ Renderer (shared across public pages)
// ════════════════════════════════════════════════════════════════
// Centralised helper that builds FAQ accordion items using safe
// DOM methods (createElement + textContent / setAttribute).
// No user-controlled values are ever passed through innerHTML.
// ════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  window.renderSafeFaqItem = function(list, faq) {
    var item = document.createElement('div');
    item.className = 'faq-item';
    item.setAttribute('data-faq-id', faq.id);

    var qBtn = document.createElement('button');
    qBtn.className = 'faq-q';
    qBtn.textContent = faq.question;

    var icon = document.createElement('span');
    icon.className = 'faq-q-icon';
    icon.textContent = '+';
    qBtn.appendChild(icon);

    var aDiv = document.createElement('div');
    aDiv.className = 'faq-a';
    aDiv.textContent = faq.answer;

    item.appendChild(qBtn);
    item.appendChild(aDiv);
    list.appendChild(item);
  };
})();
