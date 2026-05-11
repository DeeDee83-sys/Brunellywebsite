const { describe, test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { createMockSupabase } = require('./lib/mock-supabase');

// Replicate auth helpers from supabase-auth.js for testing
function signIn(email, password) {
  return global.supabaseClient.auth.signInWithPassword({ email: email, password: password });
}

function signOut() {
  global.currentSession = null;
  global.currentUser = null;
  global.currentRole = null;
  return global.supabaseClient.auth.signOut();
}

function getCurrentSession() {
  return global.supabaseClient.auth.getSession();
}

function getUserRole() {
  if (!global.currentUser) return Promise.resolve(null);
  return global.supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', global.currentUser.id)
    .single()
    .then(function(res) {
      if (res.error) {
        console.warn('getUserRole error:', res.error.message);
        return null;
      }
      return res.data ? res.data.role : null;
    })
    .catch(function(err) {
      console.warn('getUserRole exception:', err);
      return null;
    });
}

describe('Auth Flow', function() {
  var mockClient;

  beforeEach(function() {
    mockClient = createMockSupabase();
    global.supabaseClient = mockClient;
    global.currentSession = null;
    global.currentUser = null;
    global.currentRole = null;
  });

  describe('signIn', function() {
    test('succeeds with valid credentials', async function() {
      var result = await signIn('admin@brunelly.com', 'correct');
      assert.strictEqual(result.error, null);
      assert.ok(result.data.user);
      assert.strictEqual(result.data.user.email, 'admin@brunelly.com');
    });

    test('fails with invalid credentials', async function() {
      var result = await signIn('admin@brunelly.com', 'wrong');
      assert.ok(result.error);
      assert.strictEqual(result.error.message, 'Invalid login credentials');
      assert.strictEqual(result.data.user, null);
    });

    test('fails with unknown email', async function() {
      var result = await signIn('nobody@example.com', 'password');
      assert.ok(result.error);
      assert.strictEqual(result.error.message, 'Invalid login credentials');
    });
  });

  describe('getCurrentSession', function() {
    test('returns null when not signed in', async function() {
      var result = await getCurrentSession();
      assert.strictEqual(result.data.session, null);
    });

    test('returns session after sign in', async function() {
      await signIn('admin@brunelly.com', 'correct');
      var result = await getCurrentSession();
      assert.ok(result.data.session);
      assert.strictEqual(result.data.session.user.email, 'admin@brunelly.com');
    });
  });

  describe('signOut', function() {
    test('clears session and user globals', async function() {
      await signIn('admin@brunelly.com', 'correct');
      global.currentSession = { user: { id: 'admin-uuid' } };
      global.currentUser = { id: 'admin-uuid' };

      await signOut();

      assert.strictEqual(global.currentSession, null);
      assert.strictEqual(global.currentUser, null);
      assert.strictEqual(global.currentRole, null);

      var result = await getCurrentSession();
      assert.strictEqual(result.data.session, null);
    });
  });

  describe('getUserRole', function() {
    test('returns null when no current user', async function() {
      global.currentUser = null;
      var role = await getUserRole();
      assert.strictEqual(role, null);
    });

    test('returns admin role for admin user', async function() {
      await signIn('admin@brunelly.com', 'correct');
      global.currentUser = { id: 'admin-uuid' };
      mockClient._setTableData('profiles', [
        { id: 'admin-uuid', role: 'admin' }
      ]);
      var role = await getUserRole();
      assert.strictEqual(role, 'admin');
    });

    test('returns content_editor role', async function() {
      await signIn('admin@brunelly.com', 'correct');
      global.currentUser = { id: 'editor-uuid' };
      mockClient._setTableData('profiles', [
        { id: 'editor-uuid', role: 'content_editor' }
      ]);
      var role = await getUserRole();
      assert.strictEqual(role, 'content_editor');
    });

    test('returns analytics_viewer role', async function() {
      await signIn('admin@brunelly.com', 'correct');
      global.currentUser = { id: 'viewer-uuid' };
      mockClient._setTableData('profiles', [
        { id: 'viewer-uuid', role: 'analytics_viewer' }
      ]);
      var role = await getUserRole();
      assert.strictEqual(role, 'analytics_viewer');
    });

    test('returns null when profile not found', async function() {
      await signIn('admin@brunelly.com', 'correct');
      global.currentUser = { id: 'unknown-uuid' };
      mockClient._setTableData('profiles', []);
      var role = await getUserRole();
      assert.strictEqual(role, null);
    });
  });
});
