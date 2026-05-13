// ════════════════════════════════════════════════════════════════
// Extracted helpers from brunelly-admin.html for testability
// ════════════════════════════════════════════════════════════════

function getClient() {
  return global.supabaseClient || (typeof window !== 'undefined' && window.supabaseClient);
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isSafeUrl(str) {
  if (str == null) return false;
  var s = String(str).trim().toLowerCase();
  return s.indexOf('http://') === 0 || s.indexOf('https://') === 0;
}

function isSafeCssValue(str) {
  if (str == null) return false;
  var s = String(str).toLowerCase();
  if (/javascript:/.test(s)) return false;
  if (/expression\s*\(/.test(s)) return false;
  if (/url\s*\(\s*["']?javascript:/.test(s)) return false;
  return true;
}

function sbGet(table, params) {
  var select = '*';
  var orders = [];
  var limit = null;
  var filters = [];
  var hasExplicitOrder = false;

  if (params) {
    var parts = params.split('&');
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      var eqIdx = part.indexOf('=');
      if (eqIdx === -1) continue;
      var key = decodeURIComponent(part.substring(0, eqIdx));
      var val = decodeURIComponent(part.substring(eqIdx + 1));

      if (key === 'select') {
        select = val;
      } else if (key === 'order') {
        hasExplicitOrder = true;
        var orderParts = val.split(',');
        for (var j = 0; j < orderParts.length; j++) {
          var op = orderParts[j].split('.');
          orders.push({ col: op[0], asc: op[1] === 'asc' });
        }
      } else if (key === 'limit') {
        limit = parseInt(val, 10);
      } else {
        var dotIdx = val.indexOf('.');
        if (dotIdx !== -1) {
          var op = val.substring(0, dotIdx);
          var operand = val.substring(dotIdx + 1);
          if (['eq','neq','gt','gte','lt','lte','like','ilike','is'].indexOf(op) !== -1) {
            filters.push({ col: key, op: op, val: operand });
            continue;
          }
        }
        if (key.indexOf('.eq') !== -1) {
          filters.push({ col: key.replace('.eq', ''), op: 'eq', val: val });
        }
      }
    }
  }

  var query = getClient().from(table).select(select);

  if (!hasExplicitOrder && !params) {
    query = query.order('created_at', {ascending: true});
  }

  for (var k = 0; k < orders.length; k++) {
    query = query.order(orders[k].col, {ascending: orders[k].asc});
  }

  for (var m = 0; m < filters.length; m++) {
    var f = filters[m];
    if (f.op === 'eq') query = query.eq(f.col, f.val);
    else if (f.op === 'neq') query = query.neq(f.col, f.val);
    else if (f.op === 'gt') query = query.gt(f.col, f.val);
    else if (f.op === 'gte') query = query.gte(f.col, f.val);
    else if (f.op === 'lt') query = query.lt(f.col, f.val);
    else if (f.op === 'lte') query = query.lte(f.col, f.val);
    else if (f.op === 'like') query = query.like(f.col, f.val);
    else if (f.op === 'ilike') query = query.ilike(f.col, f.val);
    else if (f.op === 'is') query = query.is(f.col, f.val);
  }

  if (limit !== null) {
    query = query.limit(limit);
  }

  return query.then(function(res) {
    if (res.error) throw res.error;
    return res.data;
  });
}

function sbUpsert(table, data) {
  return getClient().from(table).upsert(data).select().then(function(res) {
    if (res.error) throw res.error;
    return res.data;
  });
}

function sbUpdate(table, id, data) {
  return getClient().from(table).update(data).eq('id', id).select().then(function(res) {
    if (res.error) throw res.error;
    return res.data;
  });
}

function sbDelete(table, id, filter) {
  var query = getClient().from(table).delete();
  if (filter && filter.op === 'gt') {
    query = query.gt(filter.col, filter.val);
  } else {
    query = query.eq('id', id);
  }
  return query.then(function(res) {
    if (res.error) throw res.error;
    return res.data;
  });
}

function stripHtml(str) {
  if (str == null) return '';
  return String(str).replace(/<[^>]*>/g, '');
}

module.exports = {
  escapeHtml,
  isSafeUrl,
  isSafeCssValue,
  stripHtml,
  sbGet,
  sbUpsert,
  sbUpdate,
  sbDelete
};
