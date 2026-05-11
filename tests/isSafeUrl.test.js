const { describe, test } = require('node:test');
const assert = require('node:assert');
const { isSafeUrl } = require('./lib/helpers');

describe('isSafeUrl', function() {
  test('accepts http://', function() {
    assert.strictEqual(isSafeUrl('http://example.com'), true);
    assert.strictEqual(isSafeUrl('http://example.com/path'), true);
  });

  test('accepts https://', function() {
    assert.strictEqual(isSafeUrl('https://example.com'), true);
    assert.strictEqual(isSafeUrl('https://example.com/path?query=1'), true);
  });

  test('rejects javascript:', function() {
    assert.strictEqual(isSafeUrl('javascript:alert(1)'), false);
    assert.strictEqual(isSafeUrl('javascript://alert(1)'), false);
    assert.strictEqual(isSafeUrl('JAVASCRIPT:alert(1)'), false);
  });

  test('rejects data:', function() {
    assert.strictEqual(isSafeUrl('data:text/html,<script>alert(1)</script>'), false);
  });

  test('rejects mailto:', function() {
    assert.strictEqual(isSafeUrl('mailto:test@example.com'), false);
  });

  test('rejects tel:', function() {
    assert.strictEqual(isSafeUrl('tel:+1234567890'), false);
  });

  test('rejects ftp:', function() {
    assert.strictEqual(isSafeUrl('ftp://example.com'), false);
  });

  test('rejects file:', function() {
    assert.strictEqual(isSafeUrl('file:///etc/passwd'), false);
  });

  test('rejects relative paths', function() {
    assert.strictEqual(isSafeUrl('/admin'), false);
    assert.strictEqual(isSafeUrl('../config'), false);
    assert.strictEqual(isSafeUrl('admin.html'), false);
  });

  test('rejects empty string', function() {
    assert.strictEqual(isSafeUrl(''), false);
  });

  test('rejects null', function() {
    assert.strictEqual(isSafeUrl(null), false);
  });

  test('rejects undefined', function() {
    assert.strictEqual(isSafeUrl(undefined), false);
  });

  test('rejects whitespace-only strings', function() {
    assert.strictEqual(isSafeUrl('   '), false);
  });

  test('trims whitespace before checking', function() {
    assert.strictEqual(isSafeUrl('  https://example.com  '), true);
    assert.strictEqual(isSafeUrl('  javascript:alert(1)  '), false);
  });
});
