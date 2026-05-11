const { describe, test } = require('node:test');
const assert = require('node:assert');
const { isSafeCssValue } = require('./lib/helpers');

describe('isSafeCssValue', function() {
  test('returns false for null/undefined', function() {
    assert.strictEqual(isSafeCssValue(null), false);
    assert.strictEqual(isSafeCssValue(undefined), false);
  });

  test('returns true for safe color values', function() {
    assert.strictEqual(isSafeCssValue('#a78bfa'), true);
    assert.strictEqual(isSafeCssValue('rgba(167,139,250,.12)'), true);
    assert.strictEqual(isSafeCssValue('var(--accent-dim)'), true);
    assert.strictEqual(isSafeCssValue('rgb(255, 0, 0)'), true);
  });

  test('returns false for javascript: scheme', function() {
    assert.strictEqual(isSafeCssValue('javascript:alert(1)'), false);
    assert.strictEqual(isSafeCssValue('background:javascript:alert(1)'), false);
  });

  test('returns false for CSS expression()', function() {
    assert.strictEqual(isSafeCssValue('expression(alert(1))'), false);
    assert.strictEqual(isSafeCssValue('width: expression(alert(1))'), false);
  });

  test('returns false for url() containing javascript:', function() {
    assert.strictEqual(isSafeCssValue('url(javascript:alert(1))'), false);
    assert.strictEqual(isSafeCssValue('url("javascript:alert(1)")'), false);
    assert.strictEqual(isSafeCssValue("url('javascript:alert(1)')"), false);
  });

  test('returns true for safe url() references', function() {
    assert.strictEqual(isSafeCssValue('url(https://example.com/img.png)'), true);
  });
});
