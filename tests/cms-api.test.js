const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Minimal DOM / window globals for cms-api.js
if (typeof window === 'undefined') {
  global.window = {
    CMS_API_BASE: 'http://localhost:3001',
    addEventListener: function() {},
    dispatchEvent: function() {}
  };
}
if (typeof document === 'undefined') {
  global.document = {};
}
if (typeof CustomEvent === 'undefined') {
  global.CustomEvent = function(name, opts) {
    this.type = name;
    this.detail = opts && opts.detail ? opts.detail : null;
  };
}

require('../cms-api.js');

describe('cms-api.js', function() {
  var originalFetch;
  var lastCall;

  beforeEach(function() {
    originalFetch = global.fetch;
    lastCall = null;
    global.fetch = function(url, options) {
      lastCall = { url: url, options: options };
      return Promise.resolve({
        ok: true,
        status: 200,
        json: function() {
          if (url.indexOf('/cms/login') !== -1) return Promise.resolve({ success: true, role: 'admin' });
          if (url.indexOf('/cms/session') !== -1) return Promise.resolve({ authenticated: true, role: 'admin' });
          if (url.indexOf('/cms/posts') !== -1 && url.indexOf('/cms/posts/') === -1) return Promise.resolve({ data: [{ id: 'p1', title: 'Test' }], count: 1 });
          if (url.indexOf('/cms/posts/p1') !== -1) return Promise.resolve({ data: { id: 'p1', title: 'Test' } });
          if (url.indexOf('/cms/upload') !== -1) return Promise.resolve({ url: '/static/blog-images/img.png' });
          return Promise.resolve({});
        }
      });
    };
  });

  afterEach(function() {
    global.fetch = originalFetch;
  });

  it('cmsLogin sends POST with credentials', async function() {
    var result = await window.cmsLogin('a@b.com', 'pass');
    assert.strictEqual(lastCall.options.method, 'POST');
    assert.strictEqual(lastCall.options.credentials, 'include');
    assert.deepStrictEqual(JSON.parse(lastCall.options.body), { email: 'a@b.com', password: 'pass' });
    assert.strictEqual(result.success, true);
  });

  it('cmsCheckSession sends GET with credentials', async function() {
    var result = await window.cmsCheckSession();
    assert.strictEqual(lastCall.options.method, 'GET');
    assert.strictEqual(lastCall.options.credentials, 'include');
    assert.strictEqual(result.authenticated, true);
  });

  it('cmsGetPosts sends GET with query params', async function() {
    var result = await window.cmsGetPosts({ status: 'published', limit: '10' });
    assert.ok(lastCall.url.indexOf('status=published') !== -1);
    assert.ok(lastCall.url.indexOf('limit=10') !== -1);
    assert.strictEqual(result.data.length, 1);
  });

  it('cmsCreatePost sends POST with JSON body', async function() {
    var payload = { title: 'New', excerpt: 'Excerpt', category: 'AI' };
    await window.cmsCreatePost(payload);
    assert.strictEqual(lastCall.options.method, 'POST');
    assert.deepStrictEqual(JSON.parse(lastCall.options.body), payload);
  });

  it('cmsUpdatePost sends PUT with id in URL', async function() {
    await window.cmsUpdatePost('p1', { title: 'Updated' });
    assert.strictEqual(lastCall.options.method, 'PUT');
    assert.ok(lastCall.url.indexOf('/cms/posts/p1') !== -1);
  });

  it('cmsDeletePost sends DELETE with id in URL', async function() {
    await window.cmsDeletePost('p1');
    assert.strictEqual(lastCall.options.method, 'DELETE');
    assert.ok(lastCall.url.indexOf('/cms/posts/p1') !== -1);
  });

  it('cmsUploadImage sends POST with file payload', async function() {
    await window.cmsUploadImage({ name: 'test.png' });
    assert.strictEqual(lastCall.options.method, 'POST');
    assert.strictEqual(lastCall.options.credentials, 'include');
  });

  it('handles 401 by dispatching sessionExpired', async function() {
    var dispatched = false;
    window.addEventListener = function(name, fn) {
      if (name === 'cms:sessionExpired') dispatched = true;
    };
    global.fetch = function() {
      return Promise.resolve({ ok: false, status: 401, json: function() { return Promise.resolve({ error: 'expired' }); } });
    };
    try {
      await window.cmsGetPosts({});
      assert.fail('Should have thrown');
    } catch (e) {
      assert.ok(e.message.indexOf('Session expired') !== -1);
    }
  });
});
