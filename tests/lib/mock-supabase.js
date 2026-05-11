// ════════════════════════════════════════════════════════════════
// Lightweight mock Supabase client for zero-dependency tests
// ════════════════════════════════════════════════════════════════

function createMockSupabase() {
  var _authSession = null;
  var _authUser = null;
  var _authCallbacks = [];
  var _db = {};

  function setTableData(table, rows) {
    _db[table] = rows || [];
  }

  function getTableData(table) {
    return (_db[table] || []).slice();
  }

  function clearTableData(table) {
    _db[table] = [];
  }

  function resetAll() {
    _authSession = null;
    _authUser = null;
    _authCallbacks = [];
    _db = {};
  }

  function setAuthSession(session, user) {
    _authSession = session;
    _authUser = user;
  }

  function buildQuery(table) {
    var rows = getTableData(table);
    var selectedColumns = null;
    var orderSpec = null;
    var limitSpec = null;
    var filters = [];

    function applyFilters(data) {
      return data.filter(function(row) {
        return filters.every(function(f) {
          var val = row[f.col];
          if (f.op === 'eq') return String(val) === String(f.val);
          if (f.op === 'neq') return String(val) !== String(f.val);
          if (f.op === 'gt') return Number(val) > Number(f.val);
          if (f.op === 'gte') return Number(val) >= Number(f.val);
          if (f.op === 'lt') return Number(val) < Number(f.val);
          if (f.op === 'lte') return Number(val) <= Number(f.val);
          if (f.op === 'like') return String(val).indexOf(f.val.replace(/%/g, '')) !== -1;
          if (f.op === 'ilike') return String(val).toLowerCase().indexOf(String(f.val).replace(/%/g, '').toLowerCase()) !== -1;
          if (f.op === 'is') return val === f.val || (f.val === 'null' && val == null);
          return true;
        });
      });
    }

    function selectResult() {
      var result = applyFilters(getTableData(table));
      if (orderSpec) {
        result.sort(function(a, b) {
          var av = a[orderSpec.col];
          var bv = b[orderSpec.col];
          if (av < bv) return orderSpec.asc ? -1 : 1;
          if (av > bv) return orderSpec.asc ? 1 : -1;
          return 0;
        });
      }
      if (limitSpec !== null) {
        result = result.slice(0, limitSpec);
      }
      if (selectedColumns && selectedColumns !== '*') {
        var cols = selectedColumns.split(',').map(function(c) { return c.trim(); });
        result = result.map(function(row) {
          var obj = {};
          cols.forEach(function(c) { obj[c] = row[c]; });
          return obj;
        });
      }
      return { data: result, error: null };
    }

    var query = {
      select: function(cols) {
        selectedColumns = cols || '*';
        return query;
      },
      order: function(col, opts) {
        orderSpec = { col: col, asc: opts && opts.ascending !== false };
        return query;
      },
      limit: function(n) {
        limitSpec = n;
        return query;
      },
      eq: function(col, val) {
        filters.push({ col: col, op: 'eq', val: val });
        return query;
      },
      neq: function(col, val) {
        filters.push({ col: col, op: 'neq', val: val });
        return query;
      },
      gt: function(col, val) {
        filters.push({ col: col, op: 'gt', val: val });
        return query;
      },
      gte: function(col, val) {
        filters.push({ col: col, op: 'gte', val: val });
        return query;
      },
      lt: function(col, val) {
        filters.push({ col: col, op: 'lt', val: val });
        return query;
      },
      lte: function(col, val) {
        filters.push({ col: col, op: 'lte', val: val });
        return query;
      },
      like: function(col, val) {
        filters.push({ col: col, op: 'like', val: val });
        return query;
      },
      ilike: function(col, val) {
        filters.push({ col: col, op: 'ilike', val: val });
        return query;
      },
      is: function(col, val) {
        filters.push({ col: col, op: 'is', val: val });
        return query;
      },
      upsert: function(data) {
        var existing = getTableData(table);
        var toInsert = Array.isArray(data) ? data : [data];
        toInsert.forEach(function(item) {
          var idx = existing.findIndex(function(r) { return r.id === item.id; });
          if (idx >= 0) existing[idx] = Object.assign({}, existing[idx], item);
          else existing.push(item);
        });
        setTableData(table, existing);
        return query;
      },
      update: function(data) {
        var existing = getTableData(table);
        var target = applyFilters(existing);
        target.forEach(function(row) {
          var idx = existing.findIndex(function(r) { return r.id === row.id; });
          if (idx >= 0) existing[idx] = Object.assign({}, existing[idx], data);
        });
        setTableData(table, existing);
        return query;
      },
      delete: function() {
        var deleteQuery = {
          eq: function(col, val) {
            filters.push({ col: col, op: 'eq', val: val });
            return deleteQuery;
          },
          gt: function(col, val) {
            filters.push({ col: col, op: 'gt', val: val });
            return deleteQuery;
          },
          then: function(onFulfilled) {
            var existing = getTableData(table);
            var remaining = existing.filter(function(row) {
              return !filters.some(function(f) {
                if (f.op === 'eq') return String(row[f.col]) === String(f.val);
                if (f.op === 'gt') return Number(row[f.col]) > Number(f.val);
                return false;
              });
            });
            setTableData(table, remaining);
            return Promise.resolve({ data: remaining, error: null }).then(onFulfilled);
          }
        };
        return deleteQuery;
      },
      single: function() {
        return {
          then: function(onFulfilled) {
            var result = selectResult();
            if (!result.data || result.data.length === 0) {
              return Promise.resolve({ data: null, error: { message: 'Not found' } }).then(onFulfilled);
            }
            return Promise.resolve({ data: result.data[0], error: null }).then(onFulfilled);
          }
        };
      },
      then: function(onFulfilled) {
        return Promise.resolve(selectResult()).then(onFulfilled);
      }
    };

    return query;
  }

  var auth = {
    signInWithPassword: function(creds) {
      if (creds.email === 'admin@brunelly.com' && creds.password === 'correct') {
        _authUser = { id: 'admin-uuid', email: creds.email };
        _authSession = { user: _authUser, access_token: 'admin-token' };
        _authCallbacks.forEach(function(cb) { cb('SIGNED_IN', _authSession); });
        return Promise.resolve({ data: { user: _authUser, session: _authSession }, error: null });
      }
      return Promise.resolve({ data: { user: null, session: null }, error: { message: 'Invalid login credentials' } });
    },
    signOut: function() {
      _authUser = null;
      _authSession = null;
      _authCallbacks.forEach(function(cb) { cb('SIGNED_OUT', null); });
      return Promise.resolve({ error: null });
    },
    getSession: function() {
      return Promise.resolve({ data: { session: _authSession }, error: null });
    },
    onAuthStateChange: function(callback) {
      _authCallbacks.push(callback);
    }
  };

  return {
    from: buildQuery,
    auth: auth,
    _setTableData: setTableData,
    _getTableData: getTableData,
    _clearTableData: clearTableData,
    _resetAll: resetAll,
    _setAuthSession: setAuthSession
  };
}

module.exports = { createMockSupabase };
