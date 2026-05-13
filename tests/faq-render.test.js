const { describe, test } = require('node:test');
const assert = require('node:assert');

// ════════════════════════════════════════════════════════════════
// Minimal mock DOM sufficient to exercise renderSafeFaqItem
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

global.document = {
  createElement: function(tag) { return mockElement(tag); },
  createTextNode: function(text) { return mockTextNode(text); }
};

// Make window available so faq-renderer.js can attach its helper
global.window = global;

// Load the production helper (tests the exact file used by public pages)
require('../faq-renderer.js');
var renderSafeFaqItem = global.renderSafeFaqItem;

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

function findByClass(el, cls) {
  var results = [];
  traverse(el, function(node) {
    if (node.className && node.className.indexOf(cls) !== -1) results.push(node);
  });
  return results;
}

// ════════════════════════════════════════════════════════════════
// XSS Regression Tests
// ════════════════════════════════════════════════════════════════

describe('FAQ Renderer XSS Regression', function() {
  test('renders malicious question as inert text, never via innerHTML', function() {
    var payload = "<script>alert('XSS')</script>";
    var list = mockElement('div');
    renderSafeFaqItem(list, { id: 'faq-1', question: payload, answer: 'Safe answer' });

    var item = list._children[0];
    assert.strictEqual(hasInnerHtml(item), false, 'no element should set innerHTML');
    assert.ok(item.textContent.indexOf(payload) !== -1, 'payload should appear only as literal text');
  });

  test('renders malicious answer as inert text, never via innerHTML', function() {
    var payload = '<img src=x onerror=alert(1)>';
    var list = mockElement('div');
    renderSafeFaqItem(list, { id: 'faq-2', question: 'Safe question', answer: payload });

    var item = list._children[0];
    assert.strictEqual(hasInnerHtml(item), false, 'no element should set innerHTML');
    assert.ok(item.textContent.indexOf(payload) !== -1, 'payload should appear only as literal text');
  });

  test('stores malicious faq id literally in data-faq-id attribute', function() {
    var maliciousId = '"><img src=x onerror=alert(1)>';
    var list = mockElement('div');
    renderSafeFaqItem(list, { id: maliciousId, question: 'Q', answer: 'A' });

    var item = list._children[0];
    assert.strictEqual(hasInnerHtml(item), false, 'no element should set innerHTML');
    assert.strictEqual(item.getAttribute('data-faq-id'), maliciousId);
  });

  test('preserves expected DOM structure for safe content', function() {
    var list = mockElement('div');
    renderSafeFaqItem(list, { id: 'faq-safe', question: 'How does it work?', answer: 'It works well.' });

    var item = list._children[0];
    assert.strictEqual(item.tagName, 'div');
    assert.strictEqual(item.className, 'faq-item');
    assert.strictEqual(item.getAttribute('data-faq-id'), 'faq-safe');

    var buttons = findByTag(item, 'button');
    assert.strictEqual(buttons.length, 1, 'one button (question)');
    assert.strictEqual(buttons[0].className, 'faq-q');
    assert.strictEqual(buttons[0].textContent.indexOf('How does it work?') !== -1, true);

    var icons = findByTag(item, 'span');
    var icon = icons.find(function(s) { return s.className === 'faq-q-icon'; });
    assert.ok(icon, 'icon span should exist');
    assert.strictEqual(icon.textContent, '+');

    var answerDivs = findByClass(item, 'faq-a');
    assert.strictEqual(answerDivs.length, 1, 'one answer div');
    assert.strictEqual(answerDivs[0].textContent, 'It works well.');
  });
});
