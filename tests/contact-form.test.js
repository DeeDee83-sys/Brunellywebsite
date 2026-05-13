const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

var htmlPath = path.join(__dirname, '..', 'brunelly-contact.html');
var html = fs.readFileSync(htmlPath, 'utf8');

// Extract the contact-form script block (the last <script> before </body>)
function extractContactScript(source) {
  var marker = "form.addEventListener('submit'";
  var start = source.indexOf(marker);
  if (start === -1) return '';
  var end = source.indexOf('})();', start);
  if (end === -1) return '';
  return source.substring(start, end + 5);
}

var scriptBlock = extractContactScript(html);

describe('Contact Form HTML Structure', function() {
  test('contains a form element with id contact-form', function() {
    assert.ok(html.includes('<form id="contact-form">'), 'Missing <form id="contact-form">');
    assert.ok(html.includes('</form>'), 'Missing </form>');
  });

  test('first name input has correct id and name', function() {
    assert.ok(/id="first-name"/.test(html), 'Missing first-name id');
    assert.ok(/name="first_name"/.test(html), 'Missing first_name name');
  });

  test('last name input has correct id and name', function() {
    assert.ok(/id="last-name"/.test(html), 'Missing last-name id');
    assert.ok(/name="last_name"/.test(html), 'Missing last_name name');
  });

  test('email input has correct id and name', function() {
    assert.ok(/id="work-email"/.test(html), 'Missing work-email id');
    assert.ok(/name="email"/.test(html), 'Missing email name');
  });

  test('company size select has correct id and name', function() {
    assert.ok(/id="company-size"/.test(html), 'Missing company-size id');
    assert.ok(/name="company_size"/.test(html), 'Missing company_size name');
  });

  test('project type select has correct id and name', function() {
    assert.ok(/id="project-type"/.test(html), 'Missing project-type id');
    assert.ok(/name="project_type"/.test(html), 'Missing project_type name');
  });

  test('message textarea has correct id and name', function() {
    assert.ok(/id="message"/.test(html), 'Missing message id');
    assert.ok(/name="message"/.test(html), 'Missing message name');
  });

  test('submit button has type submit and id contact-submit-btn', function() {
    assert.ok(/type="submit"/.test(html), 'Missing type="submit" on button');
    assert.ok(/id="contact-submit-btn"/.test(html), 'Missing contact-submit-btn id');
  });
});

describe('Contact Form Submission Script', function() {
  test('extracted script block is non-empty', function() {
    assert.ok(scriptBlock.length > 0, 'Could not extract contact form script block');
  });

  test('targets the Supabase leads endpoint', function() {
    assert.ok(
      scriptBlock.includes("window.SUPA_URL + '/rest/v1/leads'"),
      'Missing leads endpoint URL'
    );
  });

  test('uses POST method', function() {
    assert.ok(/method:\s*'POST'/.test(scriptBlock), 'Missing POST method');
  });

  test('includes required headers', function() {
    assert.ok(/'apikey':\s*window\.SUPA_KEY/.test(scriptBlock), 'Missing apikey header');
    assert.ok(
      /'Authorization':\s*'Bearer '\s*\+\s*window\.SUPA_KEY/.test(scriptBlock),
      'Missing Authorization header'
    );
    assert.ok(
      /'Prefer':\s*'return=minimal'/.test(scriptBlock),
      'Missing Prefer header'
    );
  });

  test('constructs payload with all required fields', function() {
    assert.ok(/name:\s*firstName/.test(scriptBlock), 'Missing name field in payload');
    assert.ok(/email:\s*email/.test(scriptBlock), 'Missing email field in payload');
    assert.ok(/company:/.test(scriptBlock), 'Missing company field in payload');
    assert.ok(/message:/.test(scriptBlock), 'Missing message field in payload');
    assert.ok(/source:\s*'contact-form'/.test(scriptBlock), 'Missing source field in payload');
    assert.ok(/page:\s*window\.location\.pathname/.test(scriptBlock), 'Missing page field in payload');
  });

  test('appends project type to message when provided', function() {
    assert.ok(
      /Project type:/.test(scriptBlock),
      'Missing project type append logic'
    );
  });

  test('handles non-2xx responses with error toast', function() {
    assert.ok(/!r\.ok/.test(scriptBlock), 'Missing r.ok check');
    assert.ok(
      /showToast\(.*'error'\)/.test(scriptBlock),
      'Missing error toast on failure'
    );
  });

  test('handles network failures via .catch()', function() {
    assert.ok(/\.catch\(/.test(scriptBlock), 'Missing .catch() handler');
  });

  test('re-enables submit button via .finally()', function() {
    assert.ok(/\.finally\(/.test(scriptBlock), 'Missing .finally() handler');
    assert.ok(
      /submitBtn\.disabled\s*=\s*false/.test(scriptBlock),
      'Missing button re-enable in finally'
    );
  });

  test('resets form on success', function() {
    assert.ok(
      /form\.reset\(\)/.test(scriptBlock),
      'Missing form.reset() on success'
    );
  });

  test('shows success toast on successful submission', function() {
    assert.ok(
      /showToast\(.*'success'\)/.test(scriptBlock),
      'Missing success toast'
    );
  });
});
