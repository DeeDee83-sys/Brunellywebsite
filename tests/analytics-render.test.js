const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// ════════════════════════════════════════════════════════════════
// Minimal mock DOM sufficient to exercise analytics renderers
// ════════════════════════════════════════════════════════════════

function mockElement(tag) {
  var el = {
    tagName: tag,
    nodeType: 1,
    _attrs: {},
    _children: [],
    style: {},
    _innerHtmlSet: false,
    _innerHtmlValue: '',
    className: '',
    textContent: '',
    colSpan: 0,
    src: '',
    href: '',
    onerror: null,
    value: '',
    setAttribute: function(k, v) { this._attrs[k] = String(v); },
    getAttribute: function(k) { return this._attrs[k]; },
    appendChild: function(c) {
      if (c.nodeType === 3) {
        this.textContent += c.textContent;
      } else if (c.nodeType === 1 && c.textContent) {
        this.textContent += c.textContent;
      }
      this._children.push(c);
    }
  };
  Object.defineProperty(el, 'innerHTML', {
    get: function() { return this._innerHtmlValue; },
    set: function(val) { this._innerHtmlSet = true; this._innerHtmlValue = val; }
  });
  return el;
}

function mockTextNode(text) {
  return { nodeType: 3, textContent: text };
}

var mockElements = {};

global.document = {
  createElement: function(tag) { return mockElement(tag); },
  createTextNode: function(text) { return mockTextNode(text); },
  getElementById: function(id) {
    if (!mockElements[id]) {
      if (id === 'chart-category') {
        mockElements[id] = mockElement('canvas');
        mockElements[id].getContext = function() { return {}; };
      } else if (id === 'art-sort') {
        mockElements[id] = mockElement('select');
        mockElements[id].value = 'clicks';
      } else {
        mockElements[id] = mockElement('div');
      }
    }
    return mockElements[id];
  }
};

// ════════════════════════════════════════════════════════════════
// Mock globals used by analytics renderers
// ════════════════════════════════════════════════════════════════

global.getEvents = function() { return global._testEvents || []; };
global.filterByRange = function(events) { return events; };
global.RANGE_DAYS = 0;
global.catChart = null;
global.Chart = function() { this.destroy = function() {}; };

// ════════════════════════════════════════════════════════════════
// Extract render functions from brunelly-analytics.html
// ════════════════════════════════════════════════════════════════

var analyticsSource = fs.readFileSync(path.join(__dirname, '../brunelly-analytics.html'), 'utf8');

function extractFunction(source, name) {
  var prefix = 'function ' + name;
  var start = source.indexOf(prefix);
  if (start === -1) throw new Error('Function ' + name + ' not found in source');
  var brace = source.indexOf('{', start);
  var depth = 0;
  var end = brace;
  for (var i = brace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') depth--;
    if (depth === 0) {
      end = i + 1;
      break;
    }
  }
  return source.substring(start, end);
}

eval(extractFunction(analyticsSource, 'escapeHtml'));
eval(extractFunction(analyticsSource, 'renderEvents'));
eval(extractFunction(analyticsSource, 'renderSources'));
eval(extractFunction(analyticsSource, 'renderReferrers'));
eval(extractFunction(analyticsSource, 'renderNewsletter'));
eval(extractFunction(analyticsSource, 'renderTopArticles'));
eval(extractFunction(analyticsSource, 'renderCategoryChart'));

// ════════════════════════════════════════════════════════════════
// Traversal helpers
// ════════════════════════════════════════════════════════════════

function traverse(el, cb) {
  cb(el);
  if (el._children) {
    el._children.forEach(function(c) { traverse(c, cb); });
  }
}

function hasInnerHtmlDescendants(el) {
  var found = false;
  if (el._children) {
    el._children.forEach(function(c) {
      if (c._innerHtmlSet) found = true;
      if (hasInnerHtmlDescendants(c)) found = true;
    });
  }
  return found;
}

function findByTag(el, tag) {
  var results = [];
  traverse(el, function(node) {
    if (node.tagName === tag) results.push(node);
  });
  return results;
}

function resetMocks() {
  mockElements = {};
  global._testEvents = [];
}

// ════════════════════════════════════════════════════════════════
// Malicious payloads
// ════════════════════════════════════════════════════════════════

var payloads = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(2)>',
  '<svg onload=alert(3)>',
  '"><script>alert(4)</script>',
  "'\"><script>alert(5)</script>",
  '<iframe src=javascript:alert(6)>',
  '<body onload=alert(7)>',
];

// ════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════

describe('Analytics Dashboard Render XSS Regression', function() {
  test('renderEvents: malicious articleTitle renders as inert text, never via innerHTML', function() {
    resetMocks();
    var p = payloads[0];
    global._testEvents = [
      { type: 'article_click', ts: Date.now(), articleId: '1', articleTitle: p, category: 'AI', source: 'google', device: 'desktop' }
    ];
    renderEvents();
    var tbody = mockElements['events-tbody'];
    assert.ok(!hasInnerHtmlDescendants(tbody), 'should not set innerHTML on any descendant');
    assert.ok(tbody.textContent.indexOf(p) !== -1, 'payload should appear as plain text');
  });

  test('renderEvents: malicious email renders as inert text', function() {
    resetMocks();
    var p = payloads[1];
    global._testEvents = [
      { type: 'newsletter_signup', ts: Date.now(), source: 'twitter', email: p }
    ];
    renderEvents();
    var tbody = mockElements['events-tbody'];
    assert.ok(!hasInnerHtmlDescendants(tbody), 'should not set innerHTML on any descendant');
    assert.ok(tbody.textContent.indexOf(p) !== -1, 'payload should appear as plain text');
  });

  test('renderEvents: malicious source and device render as inert text', function() {
    resetMocks();
    var p = payloads[2];
    global._testEvents = [
      { type: 'pageview', ts: Date.now(), source: p, device: p }
    ];
    renderEvents();
    var tbody = mockElements['events-tbody'];
    assert.ok(!hasInnerHtmlDescendants(tbody), 'should not set innerHTML on any descendant');
    assert.ok(tbody.textContent.indexOf(p) !== -1, 'payload should appear as plain text');
  });

  test('renderEvents: malicious type fallback renders as inert text', function() {
    resetMocks();
    var p = '<script>alert("type")</script>';
    global._testEvents = [
      { type: p, ts: Date.now(), articleTitle: null, email: null, source: null, device: null }
    ];
    renderEvents();
    var tbody = mockElements['events-tbody'];
    assert.ok(!hasInnerHtmlDescendants(tbody), 'should not set innerHTML on any descendant');
    assert.ok(tbody.textContent.indexOf(p) !== -1, 'payload should appear as plain text');
  });

  test('renderEvents: empty events show safe fallback message', function() {
    resetMocks();
    global._testEvents = [];
    renderEvents();
    var tbody = mockElements['events-tbody'];
    assert.ok(!hasInnerHtmlDescendants(tbody), 'should not set innerHTML on any descendant');
    assert.ok(tbody.textContent.indexOf('No events yet') !== -1, 'should show fallback text');
  });

  test('renderSources: malicious source name renders as inert text', function() {
    resetMocks();
    var p = payloads[0];
    var events = [
      { type: 'pageview', source: p, device: 'desktop' }
    ];
    renderSources(events);
    var container = mockElements['source-list'];
    assert.ok(!hasInnerHtmlDescendants(container), 'should not set innerHTML on any descendant');
    assert.ok(container.textContent.indexOf(p) !== -1, 'payload should appear as plain text');
  });

  test('renderReferrers: malicious source name renders as inert text', function() {
    resetMocks();
    var p = payloads[3];
    var events = [
      { type: 'pageview', source: p, device: 'desktop' },
      { type: 'article_click', source: p, device: 'desktop' }
    ];
    renderReferrers(events);
    var tbody = mockElements['referrer-tbody'];
    assert.ok(!hasInnerHtmlDescendants(tbody), 'should not set innerHTML on any descendant');
    assert.ok(tbody.textContent.indexOf(p) !== -1, 'payload should appear as plain text');
  });

  test('renderNewsletter: malicious email renders as inert text', function() {
    resetMocks();
    var p = payloads[4];
    var events = [
      { type: 'newsletter_signup', ts: Date.now(), source: 'direct', email: p }
    ];
    renderNewsletter(events);
    var container = mockElements['recent-subs'];
    assert.ok(!hasInnerHtmlDescendants(container), 'should not set innerHTML on any descendant');
    assert.ok(container.textContent.indexOf(p) !== -1, 'payload should appear as plain text');
  });

  test('renderTopArticles: malicious title and category render as inert text', function() {
    resetMocks();
    var pTitle = payloads[0];
    var pCat = payloads[1];
    global._testEvents = [
      { type: 'article_click', ts: Date.now(), articleId: '1', articleTitle: pTitle, category: pCat, source: 'google', device: 'desktop' }
    ];
    renderTopArticles();
    var tbody = mockElements['top-articles'];
    assert.ok(!hasInnerHtmlDescendants(tbody), 'should not set innerHTML on any descendant');
    assert.ok(tbody.textContent.indexOf(pTitle) !== -1, 'title payload should appear as plain text');
    assert.ok(tbody.textContent.indexOf(pCat) !== -1, 'category payload should appear as plain text');
  });

  test('renderCategoryChart: malicious category label renders as inert text', function() {
    resetMocks();
    var p = payloads[5];
    var events = [
      { type: 'article_click', ts: Date.now(), articleId: '1', articleTitle: 'X', category: p, source: 'google', device: 'desktop' }
    ];
    renderCategoryChart(events);
    var container = mockElements['cat-legend'];
    assert.ok(!hasInnerHtmlDescendants(container), 'should not set innerHTML on any descendant');
    assert.ok(container.textContent.indexOf(p) !== -1, 'payload should appear as plain text');
  });
});
