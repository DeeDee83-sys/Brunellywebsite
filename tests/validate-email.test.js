// ════════════════════════════════════════════════════════════════
// Email validation regex regression tests
// ════════════════════════════════════════════════════════════════

const { describe, it } = require('node:test');
const assert = require('node:assert');

// This must match the regex used in all newsletter signup handlers
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateEmail(email) {
  return EMAIL_RE.test(email);
}

describe('validateEmail', () => {
  it('accepts common valid emails', () => {
    assert.strictEqual(validateEmail('user@example.com'), true);
    assert.strictEqual(validateEmail('first.last@company.co.uk'), true);
    assert.strictEqual(validateEmail('name+tag@domain.org'), true);
    assert.strictEqual(validateEmail('a@b.cc'), true);
    assert.strictEqual(validateEmail('user123@test.io'), true);
  });

  it('rejects missing local part', () => {
    assert.strictEqual(validateEmail('@example.com'), false);
  });

  it('rejects missing domain', () => {
    assert.strictEqual(validateEmail('user@'), false);
    assert.strictEqual(validateEmail('user@.com'), false);
  });

  it('rejects missing @', () => {
    assert.strictEqual(validateEmail('userexample.com'), false);
  });

  it('rejects multiple @ symbols', () => {
    assert.strictEqual(validateEmail('user@@example.com'), false);
    assert.strictEqual(validateEmail('a@b@c.com'), false);
  });

  it('rejects too-short TLD', () => {
    assert.strictEqual(validateEmail('user@example.c'), false);
    assert.strictEqual(validateEmail('user@domain.a'), false);
  });

  it('rejects whitespace in email', () => {
    assert.strictEqual(validateEmail('user @example.com'), false);
    assert.strictEqual(validateEmail('user@ example.com'), false);
    assert.strictEqual(validateEmail('user name@example.com'), false);
  });

  it('rejects empty string', () => {
    assert.strictEqual(validateEmail(''), false);
  });

  it('rejects a@b (no TLD)', () => {
    assert.strictEqual(validateEmail('a@b'), false);
  });

  it('rejects test@ (trailing @)', () => {
    assert.strictEqual(validateEmail('test@'), false);
  });
});
