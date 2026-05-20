// ════════════════════════════════════════════════════════════════
// BRUNELLY CMS API CLIENT
// Centralised frontend module for all CMS backend communication.
// Handles HTTP-only cookie sessions, CSRF-safe fetch, and retries.
// ════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  var API_BASE = window.CMS_API_BASE || 'http://localhost:3001';
  var DEFAULT_RETRY = 2;

  function resolveUrl(path) {
    return API_BASE.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
  }

  function apiFetch(path, options) {
    options = options || {};
    options.credentials = 'include';
    options.headers = options.headers || {};
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    var url = resolveUrl(path);
    var attempt = 0;

    function tryFetch() {
      return fetch(url, options).then(function(r) {
        if (r.status === 401) {
          // Session expired or invalid — trigger login screen
          window.dispatchEvent(new CustomEvent('cms:sessionExpired'));
          return Promise.reject(new Error('Session expired. Please sign in again.'));
        }
        if (r.status >= 500 && attempt < DEFAULT_RETRY) {
          attempt++;
          return new Promise(function(resolve) { setTimeout(resolve, 300 * attempt); }).then(tryFetch);
        }
        if (!r.ok) {
          return r.json().then(function(body) {
            throw new Error(body.error || ('HTTP ' + r.status));
          }).catch(function(err) {
            if (err.message) throw err;
            throw new Error('HTTP ' + r.status);
          });
        }
        if (r.status === 204) return null;
        return r.json();
      });
    }

    return tryFetch();
  }

  // ── Auth ──────────────────────────────────────────────────────────
  window.cmsLogin = function(email, password) {
    return apiFetch('/cms/login', { method: 'POST', body: { email: email, password: password } });
  };

  window.cmsLogout = function() {
    return apiFetch('/cms/logout', { method: 'POST' });
  };

  window.cmsCheckSession = function() {
    return apiFetch('/cms/session', { method: 'GET' });
  };

  // ── Posts (Blog Posts) ────────────────────────────────────────────
  window.cmsGetPosts = function(params) {
    var qs = '';
    if (params) {
      var parts = [];
      if (params.status) parts.push('status=' + encodeURIComponent(params.status));
      if (params.search) parts.push('search=' + encodeURIComponent(params.search));
      if (params.category) parts.push('category=' + encodeURIComponent(params.category));
      if (params.limit) parts.push('limit=' + encodeURIComponent(params.limit));
      if (params.offset) parts.push('offset=' + encodeURIComponent(params.offset));
      if (parts.length) qs = '?' + parts.join('&');
    }
    return apiFetch('/cms/posts' + qs, { method: 'GET' });
  };

  window.cmsGetPost = function(id) {
    return apiFetch('/cms/posts/' + encodeURIComponent(id), { method: 'GET' });
  };

  window.cmsCreatePost = function(payload) {
    return apiFetch('/cms/posts', { method: 'POST', body: payload });
  };

  window.cmsUpdatePost = function(id, payload) {
    return apiFetch('/cms/posts/' + encodeURIComponent(id), { method: 'PUT', body: payload });
  };

  window.cmsDeletePost = function(id) {
    return apiFetch('/cms/posts/' + encodeURIComponent(id), { method: 'DELETE' });
  };

  // ── Upload ────────────────────────────────────────────────────────
  window.cmsUploadImage = function(file) {
    var formData = new FormData();
    formData.append('image', file);
    return apiFetch('/cms/upload', { method: 'POST', body: formData });
  };

  // ── Helpers ───────────────────────────────────────────────────────
  window.isCmsSessionError = function(err) {
    return err && err.message && err.message.indexOf('Session expired') !== -1;
  };
})();
