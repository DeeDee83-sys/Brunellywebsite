// ════════════════════════════════════════════════════════════════
// Extracted error-handling helpers for Node testability
// ════════════════════════════════════════════════════════════════

/**
 * Format an error message with a context label.
 * @param {string} context
 * @param {Error|string} error
 * @returns {string}
 */
function logError(context, error) {
  var msg = '[' + context + '] ';
  if (error && error.message) {
    msg += error.message;
  } else if (typeof error === 'string') {
    msg += error;
  } else {
    msg += 'Unknown error';
  }
  return msg;
}

/**
 * Wrap a fetch call with exponential-backoff retry.
 * @param {string} url
 * @param {object} options
 * @param {string} context
 * @param {object} env - injectable dependencies for testing
 * @returns {Promise<any>}
 */
function fetchWithRetry(url, options, context, env) {
  env = env || {};
  var fetchImpl = env.fetch || null;
  var maxAttempts = env.maxAttempts || 3;
  var baseDelay = env.baseDelay || 300;
  var setTimeoutImpl = env.setTimeout || (typeof setTimeout !== 'undefined' ? setTimeout : null);

  function attempt(n) {
    var p = fetchImpl ? fetchImpl(url, options) : Promise.reject(new Error('No fetch available'));
    return p.catch(function(err) {
      if (n < maxAttempts) {
        var delay = baseDelay * Math.pow(2, n - 1);
        return new Promise(function(resolve) {
          setTimeoutImpl(function() {
            resolve(attempt(n + 1));
          }, delay);
        });
      }
      throw err;
    });
  }

  return attempt(1).catch(function(err) {
    // In test environment we don't have console.error; just re-throw.
    throw err;
  });
}

module.exports = {
  logError: logError,
  fetchWithRetry: fetchWithRetry
};
