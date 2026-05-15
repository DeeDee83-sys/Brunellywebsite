const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { logError, fetchWithRetry } = require('./lib/error-helpers');

describe('Error Helpers', function() {
  describe('logError', function() {
    test('formats Error object with context prefix', function() {
      var result = logError('FAQs', new Error('Network timeout'));
      assert.strictEqual(result, '[FAQs] Network timeout');
    });

    test('formats string error with context prefix', function() {
      var result = logError('Analytics', 'Connection refused');
      assert.strictEqual(result, '[Analytics] Connection refused');
    });

    test('returns Unknown error for null', function() {
      var result = logError('Test', null);
      assert.strictEqual(result, '[Test] Unknown error');
    });

    test('returns Unknown error for undefined', function() {
      var result = logError('Test', undefined);
      assert.strictEqual(result, '[Test] Unknown error');
    });

    test('returns Unknown error for numeric error', function() {
      var result = logError('Test', 500);
      assert.strictEqual(result, '[Test] Unknown error');
    });
  });

  describe('fetchWithRetry', function() {
    test('succeeds on first attempt without retry', async function() {
      var callCount = 0;
      var mockFetch = function() {
        callCount++;
        return Promise.resolve({ ok: true });
      };
      await fetchWithRetry('http://test', {}, 'Test', { fetch: mockFetch });
      assert.strictEqual(callCount, 1);
    });

    test('retries with exponential backoff delays', async function() {
      var callCount = 0;
      var mockFetch = function() {
        callCount++;
        return Promise.reject(new Error('Network error'));
      };
      var delays = [];
      var mockSetTimeout = function(fn, delay) {
        delays.push(delay);
        fn();
      };
      try {
        await fetchWithRetry('http://test', {}, 'Test', {
          fetch: mockFetch,
          maxAttempts: 3,
          baseDelay: 300,
          setTimeout: mockSetTimeout
        });
      } catch (e) {
        assert.strictEqual(e.message, 'Network error');
      }
      assert.strictEqual(callCount, 3);
      assert.deepStrictEqual(delays, [300, 600]);
    });

    test('succeeds on third attempt after two failures', async function() {
      var callCount = 0;
      var mockFetch = function() {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Transient'));
        }
        return Promise.resolve({ ok: true });
      };
      var mockSetTimeout = function(fn) { fn(); };
      await fetchWithRetry('http://test', {}, 'Test', {
        fetch: mockFetch,
        maxAttempts: 3,
        baseDelay: 300,
        setTimeout: mockSetTimeout
      });
      assert.strictEqual(callCount, 3);
    });

    test('throws after maxAttempts exhausted', async function() {
      var callCount = 0;
      var mockFetch = function() {
        callCount++;
        return Promise.reject(new Error('Persistent'));
      };
      var mockSetTimeout = function(fn) { fn(); };
      try {
        await fetchWithRetry('http://test', {}, 'Test', {
          fetch: mockFetch,
          maxAttempts: 3,
          baseDelay: 300,
          setTimeout: mockSetTimeout
        });
        assert.fail('Should have thrown');
      } catch (e) {
        assert.strictEqual(e.message, 'Persistent');
        assert.strictEqual(callCount, 3);
      }
    });

    test('respects custom maxAttempts and baseDelay', async function() {
      var callCount = 0;
      var mockFetch = function() {
        callCount++;
        return Promise.reject(new Error('Fail'));
      };
      var delays = [];
      var mockSetTimeout = function(fn, delay) {
        delays.push(delay);
        fn();
      };
      try {
        await fetchWithRetry('http://test', {}, 'Test', {
          fetch: mockFetch,
          maxAttempts: 4,
          baseDelay: 100,
          setTimeout: mockSetTimeout
        });
      } catch (e) {}
      assert.strictEqual(callCount, 4);
      assert.deepStrictEqual(delays, [100, 200, 400]);
    });

    test('rejects immediately when no fetch is provided', async function() {
      try {
        await fetchWithRetry('http://test', {}, 'Test', {});
        assert.fail('Should have thrown');
      } catch (e) {
        assert.strictEqual(e.message, 'No fetch available');
      }
    });
  });
});

describe('Empty catch block regression', function() {
  function findFiles(dir, ext) {
    var results = [];
    var items = fs.readdirSync(dir);
    items.forEach(function(item) {
      var fullPath = path.join(dir, item);
      var stat = fs.statSync(fullPath);
      if (stat.isDirectory() && item !== 'node_modules') {
        results = results.concat(findFiles(fullPath, ext));
      } else if (stat.isFile() && item.endsWith(ext)) {
        results.push(fullPath);
      }
    });
    return results;
  }

  test('no raw fetch calls with empty catch handlers', function() {
    var codeDir = path.join(__dirname, '..');
    var htmlFiles = findFiles(codeDir, '.html');
    var jsFiles = findFiles(codeDir, '.js');
    var allFiles = htmlFiles.concat(jsFiles);
    var violations = [];

    allFiles.forEach(function(filePath) {
      var relPath = path.relative(codeDir, filePath);
      // Skip node_modules and build artifacts
      if (relPath.indexOf('node_modules') !== -1) return;

      var content = fs.readFileSync(filePath, 'utf8');
      var catchIndex = content.indexOf('.catch(function(){});');
      while (catchIndex !== -1) {
        // Check if fetchWithRetry appears before this catch in the file
        var beforeCatch = content.slice(0, catchIndex);
        if (beforeCatch.indexOf('fetchWithRetry(') === -1) {
          // Find line number for reporting
          var lineNum = beforeCatch.split('\n').length;
          violations.push(relPath + ':' + lineNum);
        }
        catchIndex = content.indexOf('.catch(function(){});', catchIndex + 1);
      }
    });

    assert.strictEqual(violations.length, 0,
      'Found empty catch blocks without fetchWithRetry: ' + violations.join(', '));
  });
});

describe('User-impacting fetch error handling', function() {
  test('feature image loads include toast notification on failure', function() {
    var codeDir = path.join(__dirname, '..');
    var files = [
      'brunelly-features-understand.html',
      'brunelly-features-plan.html',
      'brunelly-features-quality.html',
      'brunelly-features-collaborate.html',
      'brunelly-features-build.html'
    ];
    files.forEach(function(file) {
      var content = fs.readFileSync(path.join(codeDir, file), 'utf8');
      assert.ok(
        content.indexOf('Unable to load feature images') !== -1,
        file + ' missing feature image error toast'
      );
      assert.ok(
        content.indexOf('fetchWithRetry') !== -1,
        file + ' missing fetchWithRetry wrapper'
      );
    });
  });

  test('hero image loads include toast notification on failure', function() {
    var codeDir = path.join(__dirname, '..');
    var content = fs.readFileSync(path.join(codeDir, 'brunelly-redesign.html'), 'utf8');
    assert.ok(content.indexOf('Unable to load hero images') !== -1,
      'brunelly-redesign.html missing hero image error toast');
    assert.ok(content.indexOf('fetchWithRetry') !== -1,
      'brunelly-redesign.html missing fetchWithRetry wrapper');
  });

  test('FAQ loads include toast notification on failure', function() {
    var codeDir = path.join(__dirname, '..');
    var files = ['brunelly-features-hub.html', 'brunelly-pricing.html'];
    files.forEach(function(file) {
      var content = fs.readFileSync(path.join(codeDir, file), 'utf8');
      assert.ok(
        content.indexOf('Unable to load FAQs') !== -1,
        file + ' missing FAQ error toast'
      );
      assert.ok(
        content.indexOf('fetchWithRetry') !== -1,
        file + ' missing fetchWithRetry wrapper'
      );
    });
  });
});
