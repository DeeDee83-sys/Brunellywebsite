process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-ci';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app, supabaseAdmin } = require('../index');

// Mock data store
let mockArticles = [];

// Save original methods
const originalFrom = supabaseAdmin.from.bind(supabaseAdmin);
const originalSignIn = supabaseAdmin.auth.signInWithPassword.bind(supabaseAdmin.auth);

// Install mocks
function installMocks() {
  mockArticles = [];

  supabaseAdmin.auth.signInWithPassword = function({ email, password }) {
    if (email === 'admin@brunelly.com' && password === 'password123') {
      return Promise.resolve({
        data: { session: { access_token: 'fake-token' }, user: { id: 'user-1' } },
        error: null
      });
    }
    return Promise.resolve({ data: { session: null }, error: { message: 'Invalid credentials' } });
  };

  supabaseAdmin.from = function(table) {
    if (table === 'profiles') {
      return {
        select: function() {
          return {
            eq: function() {
              return {
                single: function() {
                  return Promise.resolve({ data: { role: 'admin' }, error: null });
                }
              };
            }
          };
        }
      };
    }

    if (table === 'articles') {
      return {
        select: function(cols, opts) {
          var builder = {
            eq: function(col, val) {
              builder._eqCol = col; builder._eqVal = val; return builder;
            },
            neq: function() { return builder; },
            gt: function() { return builder; },
            gte: function() { return builder; },
            lt: function() { return builder; },
            lte: function() { return builder; },
            like: function() { return builder; },
            ilike: function() { return builder; },
            is: function() { return builder; },
            not: function() { return builder; },
            or: function() { return builder; },
            order: function() { return builder; },
            range: function() { return builder; },
            limit: function() { return builder; },
            single: function() {
              var filtered = mockArticles.filter(function(a) {
                if (builder._eqCol && builder._eqVal !== undefined) return a[builder._eqCol] === builder._eqVal;
                return true;
              });
              return Promise.resolve({ data: filtered[0] || null, error: filtered[0] ? null : { code: 'PGRST116' } });
            },
            then: function(cb) {
              var data = mockArticles;
              if (builder._eqCol && builder._eqVal !== undefined) {
                data = mockArticles.filter(function(a) { return a[builder._eqCol] === builder._eqVal; });
              }
              return Promise.resolve(cb({ data: data, error: null }));
            }
          };
          return builder;
        },
        insert: function(data) {
          var payload = Array.isArray(data) ? data[0] : data;
          mockArticles.push(payload);
          return {
            select: function() {
              return {
                single: function() {
                  return Promise.resolve({ data: payload, error: null });
                }
              };
            }
          };
        },
        update: function(data) {
          return {
            eq: function(col, val) {
              var idx = mockArticles.findIndex(function(a) { return a.id === val; });
              if (idx !== -1) {
                Object.keys(data).forEach(function(k) { mockArticles[idx][k] = data[k]; });
              }
              return {
                select: function() {
                  return {
                    single: function() {
                      return Promise.resolve({ data: mockArticles[idx] || null, error: null });
                    }
                  };
                }
              };
            }
          };
        },
        delete: function() {
          return {
            eq: function(col, val) {
              mockArticles = mockArticles.filter(function(a) { return a.id !== val; });
              return Promise.resolve({ data: null, error: null });
            }
          };
        }
      };
    }

    return originalFrom(table);
  };
}

function restoreMocks() {
  supabaseAdmin.from = originalFrom;
  supabaseAdmin.auth.signInWithPassword = originalSignIn;
}

describe('CMS API', function() {
  var agent;

  before(function() {
    installMocks();
    agent = request.agent(app);
  });

  after(function() {
    restoreMocks();
  });

  it('GET /health returns ok', async function() {
    var res = await agent.get('/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
  });

  it('POST /cms/login succeeds with valid credentials', async function() {
    var res = await agent
      .post('/cms/login')
      .send({ email: 'admin@brunelly.com', password: 'password123' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.role, 'admin');
    assert.ok(res.headers['set-cookie']);
  });

  it('POST /cms/login fails with invalid credentials', async function() {
    var res = await request(app)
      .post('/cms/login')
      .send({ email: 'bad@example.com', password: 'wrong' });
    assert.strictEqual(res.status, 401);
  });

  it('GET /cms/session requires auth', async function() {
    var res = await request(app).get('/cms/session');
    assert.strictEqual(res.status, 401);
  });

  it('GET /cms/session returns session info when authenticated', async function() {
    var res = await agent.get('/cms/session');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.authenticated, true);
    assert.strictEqual(res.body.role, 'admin');
  });

  it('GET /cms/posts returns empty array initially', async function() {
    var res = await agent.get('/cms/posts');
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.data, []);
  });

  it('POST /cms/posts creates a post', async function() {
    var res = await agent
      .post('/cms/posts')
      .send({ title: 'Test Post', excerpt: 'A test excerpt', category: 'AI', content: '<p>Hello</p>' });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.title, 'Test Post');
  });

  it('GET /cms/posts returns created posts', async function() {
    var res = await agent.get('/cms/posts');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.length, 1);
    assert.strictEqual(res.body.data[0].title, 'Test Post');
  });

  it('GET /cms/posts/:id returns a single post', async function() {
    var postId = mockArticles[0].id;
    var res = await agent.get('/cms/posts/' + postId);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.title, 'Test Post');
  });

  it('PUT /cms/posts/:id updates a post', async function() {
    var postId = mockArticles[0].id;
    var res = await agent
      .put('/cms/posts/' + postId)
      .send({ title: 'Updated Post' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.title, 'Updated Post');
  });

  it('DELETE /cms/posts/:id removes a post', async function() {
    var postId = mockArticles[0].id;
    var res = await agent.delete('/cms/posts/' + postId);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(mockArticles.length, 0);
  });

  it('POST /cms/logout clears cookie', async function() {
    var res = await agent.post('/cms/logout');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });
});
