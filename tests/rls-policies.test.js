const { describe, test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { parsePolicies, hasPolicy, getPoliciesForTable } = require('./lib/sql-policy-parser');

var sqlPath = path.join(__dirname, '..', 'brunelly-supabase-setup.sql');
var result = parsePolicies(sqlPath);
var policies = result.policies;
var tablesWithRLS = result.tablesWithRLS;

describe('RLS Policies', function() {
  test('all expected tables have RLS enabled', function() {
    var expected = [
      'articles', 'videos', 'use_cases', 'faqs',
      'feature_images', 'hero_images', 'analytics_events', 'leads',
      'article_submissions', 'profiles'
    ];
    expected.forEach(function(table) {
      assert.ok(tablesWithRLS.indexOf(table) !== -1, 'table ' + table + ' should have RLS enabled');
    });
  });

  describe('content tables', function() {
    var contentTables = ['articles', 'videos', 'use_cases', 'faqs', 'feature_images', 'hero_images'];

    contentTables.forEach(function(table) {
      test(table + ' allows public SELECT', function() {
        assert.ok(
          hasPolicy(policies, table, 'SELECT', function(p, text) {
            return text.indexOf('true') !== -1 || text.indexOf('published') !== -1;
          }),
          table + ' should have a public SELECT policy'
        );
      });

      test(table + ' does NOT allow anonymous UPDATE', function() {
        var tablePolicies = getPoliciesForTable(policies, table);
        var hasAnonUpdate = tablePolicies.some(function(p) {
          return p.action === 'UPDATE' && (p.using || '').indexOf('true') !== -1;
        });
        assert.strictEqual(hasAnonUpdate, false, table + ' should not allow anonymous UPDATE');
      });

      test(table + ' does NOT allow anonymous DELETE', function() {
        var tablePolicies = getPoliciesForTable(policies, table);
        var hasAnonDelete = tablePolicies.some(function(p) {
          return p.action === 'DELETE' && (p.using || '').indexOf('true') !== -1;
        });
        assert.strictEqual(hasAnonDelete, false, table + ' should not allow anonymous DELETE');
      });

      test(table + ' restricts ALL to admin/content_editor', function() {
        assert.ok(
          hasPolicy(policies, table, 'ALL', function(p, text) {
            return text.indexOf('admin') !== -1 && text.indexOf('content_editor') !== -1;
          }),
          table + ' should restrict writes to admin/content_editor'
        );
      });
    });
  });

  describe('analytics_events', function() {
    test('allows public INSERT', function() {
      assert.ok(
        hasPolicy(policies, 'analytics_events', 'INSERT', function(p, text) {
          return text.indexOf('true') !== -1;
        }),
        'analytics_events should allow public INSERT'
      );
    });

    test('restricts SELECT to admin/analytics_viewer', function() {
      assert.ok(
        hasPolicy(policies, 'analytics_events', 'SELECT', function(p, text) {
          return text.indexOf('admin') !== -1 && text.indexOf('analytics_viewer') !== -1;
        }),
        'analytics_events SELECT should require admin/analytics_viewer'
      );
    });

    test('restricts DELETE to admin only', function() {
      assert.ok(
        hasPolicy(policies, 'analytics_events', 'DELETE', function(p, text) {
          return text.indexOf('admin') !== -1 && text.indexOf('analytics_viewer') === -1;
        }),
        'analytics_events DELETE should be admin-only'
      );
    });

    test('does NOT allow anonymous SELECT', function() {
      var tablePolicies = getPoliciesForTable(policies, 'analytics_events');
      var hasAnonSelect = tablePolicies.some(function(p) {
        return p.action === 'SELECT' && (p.using || '').indexOf('true') !== -1;
      });
      assert.strictEqual(hasAnonSelect, false, 'analytics_events should not allow anonymous SELECT');
    });
  });

  describe('leads', function() {
    test('allows public INSERT', function() {
      assert.ok(
        hasPolicy(policies, 'leads', 'INSERT', function(p, text) {
          return text.indexOf('true') !== -1;
        }),
        'leads should allow public INSERT'
      );
    });

    test('restricts SELECT to admin only', function() {
      assert.ok(
        hasPolicy(policies, 'leads', 'SELECT', function(p, text) {
          return text.indexOf('admin') !== -1 && text.indexOf('analytics_viewer') === -1;
        }),
        'leads SELECT should be admin-only'
      );
    });

    test('restricts DELETE to admin only', function() {
      assert.ok(
        hasPolicy(policies, 'leads', 'DELETE', function(p, text) {
          return text.indexOf('admin') !== -1 && text.indexOf('analytics_viewer') === -1;
        }),
        'leads DELETE should be admin-only'
      );
    });
  });

  describe('article_submissions', function() {
    test('allows public INSERT', function() {
      assert.ok(
        hasPolicy(policies, 'article_submissions', 'INSERT', function(p, text) {
          return text.indexOf('true') !== -1;
        }),
        'article_submissions should allow public INSERT'
      );
    });

    test('restricts SELECT to admin/content_editor', function() {
      assert.ok(
        hasPolicy(policies, 'article_submissions', 'SELECT', function(p, text) {
          return text.indexOf('admin') !== -1 && text.indexOf('content_editor') !== -1;
        }),
        'article_submissions SELECT should require admin or content_editor'
      );
    });

    test('restricts DELETE to admin only', function() {
      assert.ok(
        hasPolicy(policies, 'article_submissions', 'DELETE', function(p, text) {
          return text.indexOf('admin') !== -1 && text.indexOf('analytics_viewer') === -1;
        }),
        'article_submissions DELETE should be admin-only'
      );
    });

    test('does NOT allow anonymous SELECT', function() {
      var tablePolicies = getPoliciesForTable(policies, 'article_submissions');
      var hasAnonSelect = tablePolicies.some(function(p) {
        return p.action === 'SELECT' && (p.using || '').indexOf('true') !== -1;
      });
      assert.strictEqual(hasAnonSelect, false, 'article_submissions should not allow anonymous SELECT');
    });
  });

  describe('profiles', function() {
    test('allows users to read own profile', function() {
      assert.ok(
        hasPolicy(policies, 'profiles', 'SELECT', function(p, text) {
          return text.indexOf('auth.uid()') !== -1 && text.indexOf('id') !== -1;
        }),
        'profiles should allow users to read own profile'
      );
    });

    test('allows admins to manage all profiles', function() {
      assert.ok(
        hasPolicy(policies, 'profiles', 'ALL', function(p, text) {
          return text.indexOf('admin') !== -1;
        }),
        'profiles should allow admins to manage all profiles'
      );
    });
  });
});
