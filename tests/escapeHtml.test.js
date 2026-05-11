const { describe, test } = require('node:test');
const assert = require('node:assert');
const { escapeHtml } = require('./lib/helpers');

describe('escapeHtml', function() {
  test('returns empty string for null', function() {
    assert.strictEqual(escapeHtml(null), '');
  });

  test('returns empty string for undefined', function() {
    assert.strictEqual(escapeHtml(undefined), '');
  });

  test('returns empty string for empty string', function() {
    assert.strictEqual(escapeHtml(''), '');
  });

  test('escapes less-than', function() {
    assert.strictEqual(escapeHtml('<script>'), '&lt;script&gt;');
  });

  test('escapes greater-than', function() {
    assert.strictEqual(escapeHtml('</div>'), '&lt;/div&gt;');
  });

  test('escapes ampersand', function() {
    assert.strictEqual(escapeHtml('a & b'), 'a &amp; b');
  });

  test('escapes double quote', function() {
    assert.strictEqual(escapeHtml('value="x"'), 'value=&quot;x&quot;');
  });

  test('escapes single quote', function() {
    assert.strictEqual(escapeHtml("value='x'"), 'value=&#039;x&#039;');
  });

  test('escapes all special characters together', function() {
    var input = '<a href="http://x.com?a=1&b=2">Click \'me\'</a>';
    var expected = '&lt;a href=&quot;http://x.com?a=1&amp;b=2&quot;&gt;Click &#039;me&#039;&lt;/a&gt;';
    assert.strictEqual(escapeHtml(input), expected);
  });

  test('handles numbers by converting to string', function() {
    assert.strictEqual(escapeHtml(123), '123');
  });

  test('does not double-escape already-escaped entities', function() {
    var input = '&lt;div&gt;';
    var result = escapeHtml(input);
    assert.ok(result.indexOf('&amp;lt;') !== -1, 'should escape the leading ampersand');
  });
});
