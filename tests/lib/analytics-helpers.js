// ════════════════════════════════════════════════════════════════
// Extracted analytics helpers from brunelly-features-hub.html
// ════════════════════════════════════════════════════════════════

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function getSource(referrer) {
  var r = referrer || '';
  if (!r) return 'direct';
  if (/google/i.test(r)) return 'google';
  if (/linkedin/i.test(r)) return 'linkedin';
  if (/twitter|x\.com/i.test(r)) return 'twitter';
  if (/reddit/i.test(r)) return 'reddit';
  if (/discord/i.test(r)) return 'discord';
  return 'direct';
}

function getDevice(userAgent) {
  var u = userAgent || '';
  if (/tablet|ipad/i.test(u)) return 'tablet';
  if (/mobile|android|iphone/i.test(u)) return 'mobile';
  return 'desktop';
}

function buildPayload(evt, src, dev, t0, maxS, pageUrl) {
  return {
    type: evt.type,
    ts: evt.ts,
    source: evt.source || src,
    device: evt.device || dev,
    scroll_depth: evt.scrollDepth != null ? evt.scrollDepth : maxS,
    time_on_page: evt.timeOnPage != null ? evt.timeOnPage : (Date.now() - t0),
    article_id: evt.articleId || null,
    article_title: evt.articleTitle || null,
    category: evt.category || null,
    video_title: evt.videoTitle || null,
    email: evt.email || null,
    page_url: pageUrl || '/',
    created_at: new Date().toISOString()
  };
}

function buildPageviewPayload(evt, pageViewId, src, dev, t0, maxS, pageUrl) {
  var payload = buildPayload(evt, src, dev, t0, maxS, pageUrl);
  payload.event_id = pageViewId;
  return payload;
}

function supportsKeepalive() {
  try {
    return 'keepalive' in new Request('about:blank');
  } catch (e) {
    return false;
  }
}

function shouldTrack(consentLevel) {
  return consentLevel === 'all';
}

function sendReliably(payload, env) {
  env = env || {};
  var navigator = env.navigator || null;
  var fetchImpl = env.fetch || null;
  var XMLHttpRequestImpl = env.XMLHttpRequest || null;
  var keepaliveSupported = env.keepaliveSupported != null ? env.keepaliveSupported : supportsKeepalive();
  var SUPA_KEY = env.SUPA_KEY || '';
  var UPSERT_URL = env.UPSERT_URL || '';
  var JSON_TYPE = env.JSON_TYPE || 'application/json';

  var url = UPSERT_URL + '&apikey=' + encodeURIComponent(SUPA_KEY);
  var blob = new Blob([JSON.stringify(payload)], { type: JSON_TYPE });

  // Primary: navigator.sendBeacon — fire-and-forget, survives page death.
  if (navigator && navigator.sendBeacon) {
    try {
      if (navigator.sendBeacon(url, blob)) {
        return 'beacon';
      }
    } catch (e) {}
  }

  // Fallback 1: fetch with keepalive (supports full upsert headers).
  if (keepaliveSupported && fetchImpl) {
    fetchImpl(UPSERT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': JSON_TYPE,
        'apikey': SUPA_KEY,
        'Authorization': 'Bearer ' + SUPA_KEY,
        'Prefer': 'return=minimal, resolution=merge-duplicates'
      },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(function(){});
    return 'fetch-keepalive';
  }

  // Fallback 2: synchronous XHR for very old browsers.
  if (XMLHttpRequestImpl) {
    try {
      var xhr = new XMLHttpRequestImpl();
      xhr.open('POST', UPSERT_URL, false);
      xhr.setRequestHeader('Content-Type', JSON_TYPE);
      xhr.setRequestHeader('apikey', SUPA_KEY);
      xhr.setRequestHeader('Authorization', 'Bearer ' + SUPA_KEY);
      xhr.setRequestHeader('Prefer', 'return=minimal, resolution=merge-duplicates');
      xhr.send(JSON.stringify(payload));
      return 'xhr-sync';
    } catch (e) {}
  }

  return 'none';
}

module.exports = {
  generateId,
  getSource,
  getDevice,
  buildPayload,
  buildPageviewPayload,
  supportsKeepalive,
  shouldTrack,
  sendReliably
};
