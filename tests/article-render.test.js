const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { isSafeUrl } = require('./lib/helpers');

// ════════════════════════════════════════════════════════════════
// Minimal mock DOM sufficient to exercise buildArticleRow
// ════════════════════════════════════════════════════════════════

function mockElement(tag) {
  return {
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
}

function mockTextNode(text) {
  return { nodeType: 3, textContent: text };
}

global.document = {
  createElement: function(tag) { return mockElement(tag); },
  createTextNode: function(text) { return mockTextNode(text); }
};

// ════════════════════════════════════════════════════════════════
// Extract buildArticleRow from brunelly-admin.html so the test
// exercises the exact production helper (zero code duplication).
// ════════════════════════════════════════════════════════════════

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

function extractVar(source, name) {
  var re = new RegExp('var\\s+' + name + '\\s*=\\s*\\{[^\\}]*\\};');
  var m = source.match(re);
  if (!m) throw new Error('Var ' + name + ' not found');
  return m[0];
}

var htmlPath = path.join(__dirname, '..', 'brunelly-admin.html');
var html = fs.readFileSync(htmlPath, 'utf8');

// Inject dependencies into global scope
global.isSafeUrl = isSafeUrl;
eval(extractVar(html, 'CC'));
eval(extractVar(html, 'CB'));
eval(extractVar(html, 'CBG'));
eval(extractFunction(html, 'buildArticleRow'));

// ════════════════════════════════════════════════════════════════
// Traversal helpers
// ════════════════════════════════════════════════════════════════

function traverse(el, cb) {
  cb(el);
  if (el._children) {
    el._children.forEach(function(c) { traverse(c, cb); });
  }
}

function hasInnerHtml(el) {
  var found = false;
  traverse(el, function(node) {
    if (node._innerHtmlSet) found = true;
  });
  return found;
}

function findByTag(el, tag) {
  var results = [];
  traverse(el, function(node) {
    if (node.tagName === tag) results.push(node);
  });
  return results;
}

function allTextContent(el) {
  var texts = [];
  traverse(el, function(node) {
    if (node.nodeType === 3 && node.textContent) texts.push(node.textContent);
  });
  return texts;
}

// ════════════════════════════════════════════════════════════════
// XSS Regression Tests
// ════════════════════════════════════════════════════════════════

describe('Article Row Renderer XSS Regression', function() {
  test('renders malicious title as inert text, never via innerHTML', function() {
    var payload = '<script>alert(document.cookie)</script>';
    var row = buildArticleRow({ title: payload, category: 'AI', date: '2024-01-01', id: '1', image: '', url: '' }, 0);

    assert.strictEqual(hasInnerHtml(row), false, 'no element in the row should set innerHTML');

    var texts = allTextContent(row);
    assert.ok(
      texts.some(function(t) { return t.indexOf(payload) !== -1; }),
      'payload should appear only as literal text'
    );
  });

  test('renders malicious category as inert text', function() {
    var payload = '<img src=x onerror=alert(1)>';
    var row = buildArticleRow({ title: 'Safe', category: payload, date: '2024-01-01', id: '1', image: '', url: '' }, 0);

    assert.strictEqual(hasInnerHtml(row), false, 'no element should set innerHTML');

    var spans = findByTag(row, 'span');
    var catSpan = spans.find(function(s) { return s.textContent.indexOf(payload) !== -1; });
    assert.ok(catSpan, 'malicious category should appear as plain text inside span');
  });

  test('rejects javascript: image src', function() {
    var row = buildArticleRow({
      title: 'Safe', category: 'AI', date: '2024-01-01', id: '1',
      image: 'javascript:alert(1)', url: ''
    }, 0);

    var imgs = findByTag(row, 'img');
    assert.strictEqual(imgs.length, 0, 'no img element should be created for unsafe image URL');
  });

  test('rejects data: image src', function() {
    var row = buildArticleRow({
      title: 'Safe', category: 'AI', date: '2024-01-01', id: '1',
      image: 'data:text/html,<script>alert(1)</script>', url: ''
    }, 0);

    var imgs = findByTag(row, 'img');
    assert.strictEqual(imgs.length, 0, 'no img element should be created for data: URL');
  });

  test('rejects javascript: link href', function() {
    var row = buildArticleRow({
      title: 'Safe', category: 'AI', date: '2024-01-01', id: '1',
      image: '', url: 'javascript:alert(1)'
    }, 0);

    var anchors = findByTag(row, 'a');
    assert.strictEqual(anchors.length, 0, 'no anchor should be created for unsafe URL');

    var spans = findByTag(row, 'span');
    var urlSpan = spans.find(function(s) { return s.textContent.indexOf('javascript:alert(1)') !== -1; });
    assert.ok(urlSpan, 'unsafe URL should be rendered as plain text in a span');
  });

  test('allows safe https:// image and link URLs', function() {
    var rowImg = buildArticleRow({
      title: 'Safe', category: 'AI', date: '2024-01-01', id: '1',
      image: 'https://example.com/img.png', url: ''
    }, 0);
    var imgs = findByTag(rowImg, 'img');
    assert.strictEqual(imgs.length, 1);
    assert.strictEqual(imgs[0].src, 'https://example.com/img.png');

    var rowLink = buildArticleRow({
      title: 'Safe', category: 'AI', date: '2024-01-01', id: '1',
      image: '', url: 'https://example.com/article'
    }, 0);
    var anchors = findByTag(rowLink, 'a');
    assert.strictEqual(anchors.length, 1);
    assert.strictEqual(anchors[0].href, 'https://example.com/article');
    assert.strictEqual(anchors[0].target, '_blank');
  });

  test('preserves data-* attributes for edit/delete buttons', function() {
    var row = buildArticleRow({
      title: 'Title', category: 'AI', date: '2024-01-01', id: 'article-42', image: '', url: ''
    }, 7);

    var buttons = findByTag(row, 'button');
    assert.strictEqual(buttons.length, 2);

    var editBtn = buttons.find(function(b) { return b.textContent === 'Edit'; });
    var delBtn = buttons.find(function(b) { return b.textContent === 'Delete'; });

    assert.ok(editBtn, 'Edit button should exist');
    assert.ok(delBtn, 'Delete button should exist');

    assert.strictEqual(editBtn.getAttribute('data-action'), 'edit');
    assert.strictEqual(editBtn.getAttribute('data-type'), 'articles');
    assert.strictEqual(editBtn.getAttribute('data-index'), '7');
    assert.strictEqual(delBtn.getAttribute('data-action'), 'delete');
    assert.strictEqual(delBtn.getAttribute('data-table'), 'articles');
    assert.strictEqual(delBtn.getAttribute('data-id'), 'article-42');
  });

  test('malicious id in data-id attribute is stored literally, not executed', function() {
    var maliciousId = '\"><img src=x onerror=alert(1)>';
    var row = buildArticleRow({
      title: 'Title', category: 'AI', date: '2024-01-01', id: maliciousId, image: '', url: ''
    }, 0);

    assert.strictEqual(hasInnerHtml(row), false, 'no element should set innerHTML');

    var buttons = findByTag(row, 'button');
    var delBtn = buttons.find(function(b) { return b.textContent === 'Delete'; });
    assert.strictEqual(delBtn.getAttribute('data-id'), maliciousId);
  });
});
