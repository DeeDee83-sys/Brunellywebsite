const { describe, test } = require('node:test');
const assert = require('node:assert');
const {
  generateId,
  getSource,
  getDevice,
  buildPayload,
  buildPageviewPayload,
  shouldTrack,
  sendReliably
} = require('./lib/analytics-helpers');

describe('Analytics Tracking', function() {
  describe('generateId', function() {
    test('returns a non-empty string', function() {
      var id = generateId();
      assert.strictEqual(typeof id, 'string');
      assert.ok(id.length > 0);
    });

    test('returns unique values across multiple calls', function() {
      var ids = new Set();
      for (var i = 0; i < 20; i++) {
        ids.add(generateId());
      }
      assert.strictEqual(ids.size, 20);
    });
  });

  describe('getSource', function() {
    test('returns direct for empty referrer', function() {
      assert.strictEqual(getSource(''), 'direct');
      assert.strictEqual(getSource(null), 'direct');
    });

    test('detects google referrer', function() {
      assert.strictEqual(getSource('https://www.google.com/search?q=test'), 'google');
    });

    test('detects linkedin referrer', function() {
      assert.strictEqual(getSource('https://www.linkedin.com/feed/'), 'linkedin');
    });

    test('detects twitter referrer', function() {
      assert.strictEqual(getSource('https://twitter.com/home'), 'twitter');
      assert.strictEqual(getSource('https://x.com/home'), 'twitter');
    });

    test('detects reddit referrer', function() {
      assert.strictEqual(getSource('https://www.reddit.com/r/webdev'), 'reddit');
    });

    test('detects discord referrer', function() {
      assert.strictEqual(getSource('https://discord.com/channels'), 'discord');
    });

    test('returns direct for unknown referrer', function() {
      assert.strictEqual(getSource('https://example.com/page'), 'direct');
    });
  });

  describe('getDevice', function() {
    test('detects tablet', function() {
      assert.strictEqual(getDevice('Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)'), 'tablet');
    });

    test('detects mobile', function() {
      assert.strictEqual(getDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'), 'mobile');
      assert.strictEqual(getDevice('Mozilla/5.0 (Linux; Android 10)'), 'mobile');
    });

    test('returns desktop for desktop UA', function() {
      assert.strictEqual(getDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'desktop');
    });

    test('returns desktop for empty UA', function() {
      assert.strictEqual(getDevice(''), 'desktop');
    });
  });

  describe('buildPayload', function() {
    test('includes all required analytics columns', function() {
      var payload = buildPayload(
        { type: 'pageview', ts: 12345 },
        'google', 'desktop', 12345, 50, '/features'
      );
      assert.strictEqual(payload.type, 'pageview');
      assert.strictEqual(payload.ts, 12345);
      assert.strictEqual(payload.source, 'google');
      assert.strictEqual(payload.device, 'desktop');
      assert.strictEqual(payload.scroll_depth, 50);
      assert.ok(typeof payload.time_on_page === 'number');
      assert.strictEqual(payload.article_id, null);
      assert.strictEqual(payload.article_title, null);
      assert.strictEqual(payload.category, null);
      assert.strictEqual(payload.video_title, null);
      assert.strictEqual(payload.email, null);
      assert.strictEqual(payload.page_url, '/features');
      assert.ok(typeof payload.created_at === 'string');
    });

    test('uses provided scrollDepth and timeOnPage when given', function() {
      var payload = buildPayload(
        { type: 'pageview', ts: 12345, scrollDepth: 75, timeOnPage: 30000 },
        'direct', 'mobile', 12345, 0, '/'
      );
      assert.strictEqual(payload.scroll_depth, 75);
      assert.strictEqual(payload.time_on_page, 30000);
    });

    test('uses fallback source and device from closure', function() {
      var payload = buildPayload(
        { type: 'article_click', ts: 12345 },
        'reddit', 'tablet', 12345, 10, '/resources'
      );
      assert.strictEqual(payload.source, 'reddit');
      assert.strictEqual(payload.device, 'tablet');
    });
  });

  describe('buildPageviewPayload', function() {
    test('includes event_id for idempotency', function() {
      var payload = buildPageviewPayload(
        { type: 'pageview', ts: 12345 },
        'test-event-id-123',
        'google', 'desktop', 12345, 50, '/features'
      );
      assert.strictEqual(payload.event_id, 'test-event-id-123');
      assert.strictEqual(payload.type, 'pageview');
      assert.strictEqual(payload.source, 'google');
    });

    test('same event_id across multiple calls prevents duplicates', function() {
      var evt = { type: 'pageview', ts: 12345, scrollDepth: 25, timeOnPage: 10000 };
      var p1 = buildPageviewPayload(evt, 'abc-123', 'direct', 'desktop', 12345, 25, '/');
      var p2 = buildPageviewPayload(evt, 'abc-123', 'direct', 'desktop', 12345, 25, '/');
      assert.strictEqual(p1.event_id, 'abc-123');
      assert.strictEqual(p2.event_id, 'abc-123');
      assert.strictEqual(p1.event_id, p2.event_id);
      assert.deepStrictEqual(p1, p2);
    });
  });

  describe('shouldTrack', function() {
    test('returns true when consent is all', function() {
      assert.strictEqual(shouldTrack('all'), true);
    });

    test('returns false when consent is essential', function() {
      assert.strictEqual(shouldTrack('essential'), false);
    });

    test('returns false when consent is null', function() {
      assert.strictEqual(shouldTrack(null), false);
    });

    test('returns false when consent is undefined', function() {
      assert.strictEqual(shouldTrack(undefined), false);
    });

    test('returns false when consent is empty string', function() {
      assert.strictEqual(shouldTrack(''), false);
    });
  });

  describe('sendReliably transport selection', function() {
    test('prefers fetch(keepalive) when available', function() {
      var fetchCalled = false;
      var fetchOpts = null;
      var mockFetch = function(url, opts) {
        fetchCalled = true;
        fetchOpts = opts;
        assert.strictEqual(opts.keepalive, true);
        assert.strictEqual(opts.method, 'POST');
        assert.ok(opts.headers['Prefer'].indexOf('merge-duplicates') !== -1);
        return Promise.resolve({ ok: true });
      };
      var result = sendReliably(
        { type: 'pageview', event_id: 'ev-1' },
        { navigator: { sendBeacon: function() { return true; } }, fetch: mockFetch, keepaliveSupported: true, SUPA_KEY: 'test-key', UPSERT_URL: 'http://test/rest/v1/analytics_events?on_conflict=event_id' }
      );
      assert.strictEqual(fetchCalled, true);
      assert.strictEqual(result, 'fetch-keepalive');
    });

    test('falls back to navigator.sendBeacon when keepalive fetch is unavailable', function() {
      var beaconCalled = false;
      var beaconUrl = null;
      var mockNavigator = {
        sendBeacon: function(url, data) {
          beaconCalled = true;
          beaconUrl = url;
          assert.ok(data instanceof Blob);
          return true;
        }
      };
      var result = sendReliably(
        { type: 'pageview', event_id: 'ev-2' },
        { navigator: mockNavigator, keepaliveSupported: false, SUPA_KEY: 'test-key', UPSERT_URL: 'http://test/rest/v1/analytics_events?on_conflict=event_id' }
      );
      assert.strictEqual(beaconCalled, true);
      assert.ok(beaconUrl.indexOf('apikey=') !== -1);
      assert.ok(beaconUrl.indexOf('on_conflict=event_id') !== -1);
      assert.strictEqual(result, 'beacon');
    });

    test('falls back to XMLHttpRequest when keepalive fetch and sendBeacon are unavailable', function() {
      var openCalled = false;
      var sendCalled = false;
      var headers = {};
      function MockXHR() {}
      MockXHR.prototype.open = function(method, url, async) {
        openCalled = true;
        assert.strictEqual(method, 'POST');
        assert.strictEqual(async, false);
      };
      MockXHR.prototype.setRequestHeader = function(key, val) {
        headers[key] = val;
      };
      MockXHR.prototype.send = function(body) {
        sendCalled = true;
        assert.ok(body);
      };
      var result = sendReliably(
        { type: 'pageview', event_id: 'ev-3' },
        { navigator: {}, keepaliveSupported: false, XMLHttpRequest: MockXHR, SUPA_KEY: 'test-key', UPSERT_URL: 'http://test/rest/v1/analytics_events?on_conflict=event_id' }
      );
      assert.strictEqual(openCalled, true);
      assert.strictEqual(sendCalled, true);
      assert.strictEqual(headers['Prefer'], 'return=minimal, resolution=merge-duplicates');
      assert.strictEqual(result, 'xhr-sync');
    });

    test('falls back to navigator.sendBeacon when fetch throws synchronously', function() {
      var fetchCalled = false;
      var beaconCalled = false;
      var mockFetch = function() { fetchCalled = true; throw new Error('fetch error'); };
      var mockNavigator = {
        sendBeacon: function() { beaconCalled = true; return true; }
      };
      var result = sendReliably(
        { type: 'pageview', event_id: 'ev-4' },
        { navigator: mockNavigator, fetch: mockFetch, keepaliveSupported: true, SUPA_KEY: 'test-key', UPSERT_URL: 'http://test/rest/v1/analytics_events?on_conflict=event_id' }
      );
      assert.strictEqual(fetchCalled, true);
      assert.strictEqual(beaconCalled, true);
      assert.strictEqual(result, 'beacon');
    });

    test('returns none when no transport is available', function() {
      var result = sendReliably(
        { type: 'pageview', event_id: 'ev-5' },
        { navigator: {}, keepaliveSupported: false, SUPA_KEY: 'test-key', UPSERT_URL: 'http://test/rest/v1/analytics_events?on_conflict=event_id' }
      );
      assert.strictEqual(result, 'none');
    });

    test('falls back to XMLHttpRequest when fetch and sendBeacon both throw', function() {
      var openCalled = false;
      var sendCalled = false;
      function MockXHR() {}
      MockXHR.prototype.open = function(method, url, async) {
        openCalled = true;
        assert.strictEqual(method, 'POST');
        assert.strictEqual(async, false);
      };
      MockXHR.prototype.setRequestHeader = function() {};
      MockXHR.prototype.send = function(body) {
        sendCalled = true;
        assert.ok(body);
      };
      var mockFetch = function() { throw new Error('fetch error'); };
      var mockNavigator = {
        sendBeacon: function() { throw new Error('beacon error'); }
      };
      var result = sendReliably(
        { type: 'pageview', event_id: 'ev-6' },
        { navigator: mockNavigator, fetch: mockFetch, keepaliveSupported: true, XMLHttpRequest: MockXHR, SUPA_KEY: 'test-key', UPSERT_URL: 'http://test/rest/v1/analytics_events?on_conflict=event_id' }
      );
      assert.strictEqual(openCalled, true);
      assert.strictEqual(sendCalled, true);
      assert.strictEqual(result, 'xhr-sync');
    });
  });
});
