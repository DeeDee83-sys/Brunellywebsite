const { describe, test } = require('node:test');
const assert = require('node:assert');
const { stripHtml } = require('./lib/helpers');

describe('stripHtml', function() {
  test('returns empty string for null', function() {
    assert.strictEqual(stripHtml(null), '');
  });

  test('returns empty string for undefined', function() {
    assert.strictEqual(stripHtml(undefined), '');
  });

  test('returns empty string for empty string', function() {
    assert.strictEqual(stripHtml(''), '');
  });

  test('leaves plain text unchanged', function() {
    assert.strictEqual(stripHtml('Hello world'), 'Hello world');
  });

  test('strips simple script tags', function() {
    assert.strictEqual(stripHtml('<script>alert(1)</script>'), 'alert(1)');
  });

  test('strips div tags', function() {
    assert.strictEqual(stripHtml('<div>content</div>'), 'content');
  });

  test('strips nested tags', function() {
    assert.strictEqual(stripHtml('<p><strong>bold</strong> text</p>'), 'bold text');
  });

  test('strips tags with attributes', function() {
    assert.strictEqual(stripHtml('<a href="http://evil.com" onclick="alert(1)">click</a>'), 'click');
  });

  test('strips self-closing tags', function() {
    assert.strictEqual(stripHtml('Hello<br/>world'), 'Helloworld');
  });

  test('strips img tags', function() {
    assert.strictEqual(stripHtml('<img src="x" onerror="alert(1)">'), '');
  });

  test('handles mixed content', function() {
    var input = 'FAQ: <b>How do I start?</b> <script>steal()</script>Just ask.';
    assert.strictEqual(stripHtml(input), 'FAQ: How do I start? steal()Just ask.');
  });

  test('handles numbers by converting to string', function() {
    assert.strictEqual(stripHtml(123), '123');
  });

  test('strips multiline HTML', function() {
    var input = '<div>\n  <p>line1</p>\n  <p>line2</p>\n</div>';
    assert.strictEqual(stripHtml(input), '\n  line1\n  line2\n');
  });
});
