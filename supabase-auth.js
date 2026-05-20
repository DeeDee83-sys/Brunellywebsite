// ════════════════════════════════════════════════════════════════
// BRUNELLY — Supabase Auth & Role Helpers
// ════════════════════════════════════════════════════════════════
// Loads the Supabase JS client and exposes shared auth helpers.
// Must be included AFTER supabase-js CDN and supabase-config.js.
// ════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  if (typeof supabase === 'undefined') {
    console.error('supabase-auth.js: @supabase/supabase-js must be loaded before this script.');
    return;
  }
  if (typeof window.SUPA_URL === 'undefined' || typeof window.SUPA_KEY === 'undefined') {
    console.error('supabase-auth.js: SUPA_URL and SUPA_KEY must be defined before this script.');
    return;
  }

  window.supabaseClient = supabase.createClient(window.SUPA_URL, window.SUPA_KEY);

  window.currentSession = null;
  window.currentUser = null;
  window.currentRole = null;

  window.signIn = function(email, password) {
    return window.supabaseClient.auth.signInWithPassword({ email: email, password: password });
  };

  window.signOut = function() {
    window.currentSession = null;
    window.currentUser = null;
    window.currentRole = null;
    return window.supabaseClient.auth.signOut();
  };

  window.getCurrentSession = function() {
    return window.supabaseClient.auth.getSession();
  };

  window.getUserRole = function() {
    if (!window.currentUser) return Promise.resolve(null);
    return window.supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', window.currentUser.id)
      .single()
      .then(function(res) {
        if (res.error) {
          console.error('getUserRole error:', res.error.code, res.error.message);
          return null;
        }
        return res.data ? res.data.role : null;
      })
      .catch(function(err) {
        console.error('getUserRole exception:', err);
        return null;
      });
  };

  // Keep local state in sync with Supabase auth events
  window.supabaseClient.auth.onAuthStateChange(function(event, session) {
    if (event === 'SIGNED_OUT') {
      window.currentSession = null;
      window.currentUser = null;
      window.currentRole = null;
    } else if (session) {
      window.currentSession = session;
      window.currentUser = session.user;
    }
  });
})();
