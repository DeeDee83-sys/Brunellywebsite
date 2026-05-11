const { describe, test } = require('node:test');
const assert = require('node:assert');

// Replicate the role-gating logic from both dashboards for testing
function canAccessAdmin(role) {
  return role === 'admin' || role === 'content_editor';
}

function canAccessAnalytics(role) {
  return role === 'admin' || role === 'analytics_viewer';
}

describe('Role Gating', function() {
  describe('Admin dashboard (brunelly-admin.html)', function() {
    test('admin can access', function() {
      assert.strictEqual(canAccessAdmin('admin'), true);
    });

    test('content_editor can access', function() {
      assert.strictEqual(canAccessAdmin('content_editor'), true);
    });

    test('analytics_viewer cannot access', function() {
      assert.strictEqual(canAccessAdmin('analytics_viewer'), false);
    });

    test('unknown role cannot access', function() {
      assert.strictEqual(canAccessAdmin('visitor'), false);
    });

    test('null role cannot access', function() {
      assert.strictEqual(canAccessAdmin(null), false);
    });

    test('undefined role cannot access', function() {
      assert.strictEqual(canAccessAdmin(undefined), false);
    });

    test('empty string role cannot access', function() {
      assert.strictEqual(canAccessAdmin(''), false);
    });
  });

  describe('Analytics dashboard (brunelly-analytics.html)', function() {
    test('admin can access', function() {
      assert.strictEqual(canAccessAnalytics('admin'), true);
    });

    test('analytics_viewer can access', function() {
      assert.strictEqual(canAccessAnalytics('analytics_viewer'), true);
    });

    test('content_editor cannot access', function() {
      assert.strictEqual(canAccessAnalytics('content_editor'), false);
    });

    test('unknown role cannot access', function() {
      assert.strictEqual(canAccessAnalytics('visitor'), false);
    });

    test('null role cannot access', function() {
      assert.strictEqual(canAccessAnalytics(null), false);
    });

    test('undefined role cannot access', function() {
      assert.strictEqual(canAccessAnalytics(undefined), false);
    });

    test('empty string role cannot access', function() {
      assert.strictEqual(canAccessAnalytics(''), false);
    });
  });

  describe('Mutual exclusivity', function() {
    test('analytics_viewer is blocked from admin but allowed in analytics', function() {
      assert.strictEqual(canAccessAdmin('analytics_viewer'), false);
      assert.strictEqual(canAccessAnalytics('analytics_viewer'), true);
    });

    test('content_editor is allowed in admin but blocked from analytics', function() {
      assert.strictEqual(canAccessAdmin('content_editor'), true);
      assert.strictEqual(canAccessAnalytics('content_editor'), false);
    });

    test('admin is allowed in both dashboards', function() {
      assert.strictEqual(canAccessAdmin('admin'), true);
      assert.strictEqual(canAccessAnalytics('admin'), true);
    });
  });
});
