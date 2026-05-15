// ════════════════════════════════════════════════════════════════
// Shared error-handling utility for BrunellySite
// Provides: consistent logging, user-visible toast notifications,
// and exponential-backoff retry for transient fetch failures.
// ════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  var TOAST_DURATION = 3000;
  var BASE_DELAY = 300;
  var MAX_ATTEMPTS = 3;

  /**
   * Ensure a toast element exists in the DOM.
   * Reuses an existing #toast if present; otherwise creates one
   * with self-contained inline styles.
   */
  function ensureToastElement() {
    var el = document.getElementById('toast');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'toast';
    el.dataset.brunellyToast = 'managed';
    el.style.cssText = (
      'position:fixed;' +
      'bottom:2rem;' +
      'right:2rem;' +
      'z-index:9999;' +
      'padding:.9rem 1.5rem;' +
      'border-radius:8px;' +
      'font-family:"DM Mono",monospace;' +
      'font-size:.75rem;' +
      'letter-spacing:.06em;' +
      'display:none;' +
      'align-items:center;' +
      'gap:.6rem;'
    );
    document.body.appendChild(el);
    return el;
  }

  /**
   * Display a temporary toast notification.
   * @param {string} msg
   * @param {string} type - 'success' | 'error'
   */
  function showToast(msg, type) {
    type = type || 'success';
    var el = ensureToastElement();
    el.textContent = (type === 'success' ? '\u2713 ' : '\u2715 ') + msg;

    if (el.dataset.brunellyToast === 'managed') {
      // Element was created by this utility — use inline styles.
      if (type === 'error') {
        el.style.background = 'rgba(248,113,113,.08)';
        el.style.border = '1px solid rgba(248,113,113,.3)';
        el.style.color = '#f87171';
      } else {
        el.style.background = 'rgba(74,222,128,.08)';
        el.style.border = '1px solid #22c55e';
        el.style.color = '#4ade80';
      }
    } else {
      // Page provides its own .toast CSS — delegate to classes.
      el.className = 'toast ' + type;
    }

    el.style.display = 'flex';
    setTimeout(function() {
      el.style.display = 'none';
    }, TOAST_DURATION);
  }

  /**
   * Log an error to the console with a context label.
   * @param {string} context
   * @param {Error|string} error
   */
  function logError(context, error) {
    var msg = '[' + context + '] ';
    if (error && error.message) {
      msg += error.message;
    } else if (typeof error === 'string') {
      msg += error;
    } else {
      msg += 'Unknown error';
    }
    console.error(msg);
  }

  /**
   * Wrap a fetch call with exponential-backoff retry.
   * Retries up to MAX_ATTEMPTS times (initial + 2 retries).
   * @param {string} url
   * @param {RequestInit} options
   * @param {string} context - used for final error logging
   * @returns {Promise<Response>}
   */
  function fetchWithRetry(url, options, context) {
    function attempt(n) {
      return fetch(url, options).catch(function(err) {
        if (n < MAX_ATTEMPTS) {
          var delay = BASE_DELAY * Math.pow(2, n - 1);
          return new Promise(function(resolve) {
            setTimeout(function() {
              resolve(attempt(n + 1));
            }, delay);
          });
        }
        throw err;
      });
    }

    return attempt(1).catch(function(err) {
      logError(context, err);
      throw err;
    });
  }

  /**
   * Unified fetch-error handler.
   * Logs the error and optionally surfaces a toast to the user.
   * @param {string} context
   * @param {Error|string} error
   * @param {boolean} notifyUser - whether to show a toast
   */
  function handleFetchError(context, error, notifyUser) {
    logError(context, error);
    if (notifyUser && typeof window.showToast === 'function') {
      window.showToast(
        'Unable to load ' + context + '. Please try again later.',
        'error'
      );
    }
  }

  // ── Expose on window ───────────────────────────────────────────
  window.logError = logError;
  window.fetchWithRetry = fetchWithRetry;
  window.handleFetchError = handleFetchError;

  // Only define showToast if the page hasn't already provided one.
  if (!window.showToast) {
    window.showToast = showToast;
  }
})();
