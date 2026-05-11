// ════════════════════════════════════════════════════════════════
// Parse brunelly-supabase-setup.sql for RLS policy validation
// ════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

function extractParens(text, keyword) {
  var idx = text.toUpperCase().indexOf(keyword.toUpperCase());
  if (idx === -1) return null;
  var start = idx + keyword.length;
  // skip whitespace
  while (start < text.length && /\s/.test(text[start])) start++;
  if (text[start] !== '(') return null;
  var depth = 0;
  var result = '';
  for (var i = start; i < text.length; i++) {
    if (text[i] === '(') depth++;
    if (text[i] === ')') depth--;
    result += text[i];
    if (depth === 0) {
      return result.slice(1, -1).trim();
    }
  }
  return null;
}

function parsePolicies(sqlPath) {
  var sql = fs.readFileSync(sqlPath, 'utf8');
  var lines = sql.split('\n');
  var tablesWithRLS = [];
  var policies = [];

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();

    // RLS enabled tables
    var rlsMatch = line.match(/ALTER TABLE\s+(\S+)\s+ENABLE ROW LEVEL SECURITY/i);
    if (rlsMatch) {
      tablesWithRLS.push(rlsMatch[1]);
    }

    // CREATE POLICY — collect multi-line statement
    var policyStart = line.match(/CREATE POLICY\s+"([^"]+)"/i);
    if (policyStart) {
      var name = policyStart[1];
      var buffer = line;
      var j = i;
      while (j < lines.length && buffer.indexOf(');') === -1) {
        j++;
        buffer += '\n' + lines[j];
      }
      buffer = buffer.replace(/--[\s\S]*?(?=\n|$)/g, ' ');

      var onMatch = buffer.match(/ON\s+(\S+)\s+FOR\s+(\S+)/i);
      if (!onMatch) continue;

      var policy = {
        name: name,
        table: onMatch[1],
        action: onMatch[2].toUpperCase()
      };

      var usingExpr = extractParens(buffer, 'USING');
      var withCheckExpr = extractParens(buffer, 'WITH CHECK');

      if (usingExpr) policy.using = usingExpr;
      if (withCheckExpr) policy.withCheck = withCheckExpr;

      policies.push(policy);
      i = j;
    }
  }

  return { tablesWithRLS, policies };
}

function getPoliciesForTable(policies, table) {
  return policies.filter(function(p) { return p.table === table; });
}

function hasPolicy(policies, table, action, predicate) {
  return policies.some(function(p) {
    if (p.table !== table) return false;
    if (p.action !== action.toUpperCase()) return false;
    if (predicate) {
      var text = (p.using || '') + ' ' + (p.withCheck || '');
      return predicate(p, text);
    }
    return true;
  });
}

module.exports = {
  parsePolicies,
  getPoliciesForTable,
  hasPolicy
};
