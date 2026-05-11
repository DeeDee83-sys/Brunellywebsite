const { describe, test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { sbGet, sbUpsert, sbUpdate, sbDelete } = require('./lib/helpers');
const { createMockSupabase } = require('./lib/mock-supabase');

describe('CRUD Helpers', function() {
  var mockClient;

  beforeEach(function() {
    mockClient = createMockSupabase();
    global.supabaseClient = mockClient;
  });

  describe('sbGet', function() {
    test('returns all rows when no params', async function() {
      mockClient._setTableData('articles', [
        { id: 'a1', title: 'First', created_at: '2024-01-01' },
        { id: 'a2', title: 'Second', created_at: '2024-01-02' }
      ]);
      var data = await sbGet('articles');
      assert.strictEqual(data.length, 2);
      assert.strictEqual(data[0].id, 'a1');
    });

    test('applies eq filter', async function() {
      mockClient._setTableData('articles', [
        { id: 'a1', category: 'tech' },
        { id: 'a2', category: 'business' }
      ]);
      var data = await sbGet('articles', 'category=eq.tech');
      assert.strictEqual(data.length, 1);
      assert.strictEqual(data[0].id, 'a1');
    });

    test('applies gt filter', async function() {
      mockClient._setTableData('analytics_events', [
        { id: 1, ts: 1000 },
        { id: 2, ts: 2000 },
        { id: 3, ts: 3000 }
      ]);
      var data = await sbGet('analytics_events', 'ts=gt.1500');
      assert.strictEqual(data.length, 2);
      assert.strictEqual(data[0].id, 2);
    });

    test('applies gte filter', async function() {
      mockClient._setTableData('analytics_events', [
        { id: 1, ts: 1000 },
        { id: 2, ts: 2000 }
      ]);
      var data = await sbGet('analytics_events', 'ts=gte.2000');
      assert.strictEqual(data.length, 1);
      assert.strictEqual(data[0].id, 2);
    });

    test('applies lt filter', async function() {
      mockClient._setTableData('analytics_events', [
        { id: 1, ts: 1000 },
        { id: 2, ts: 2000 }
      ]);
      var data = await sbGet('analytics_events', 'ts=lt.2000');
      assert.strictEqual(data.length, 1);
      assert.strictEqual(data[0].id, 1);
    });

    test('applies lte filter', async function() {
      mockClient._setTableData('analytics_events', [
        { id: 1, ts: 1000 },
        { id: 2, ts: 2000 }
      ]);
      var data = await sbGet('analytics_events', 'ts=lte.2000');
      assert.strictEqual(data.length, 2);
    });

    test('applies neq filter', async function() {
      mockClient._setTableData('articles', [
        { id: 'a1', category: 'tech' },
        { id: 'a2', category: 'business' }
      ]);
      var data = await sbGet('articles', 'category=neq.tech');
      assert.strictEqual(data.length, 1);
      assert.strictEqual(data[0].id, 'a2');
    });

    test('applies like filter', async function() {
      mockClient._setTableData('articles', [
        { id: 'a1', title: 'Hello World' },
        { id: 'a2', title: 'Goodbye' }
      ]);
      var data = await sbGet('articles', 'title=like.%25Hello%25');
      assert.strictEqual(data.length, 1);
      assert.strictEqual(data[0].id, 'a1');
    });

    test('applies ilike filter (case-insensitive)', async function() {
      mockClient._setTableData('articles', [
        { id: 'a1', title: 'Hello World' },
        { id: 'a2', title: 'HELLO AGAIN' }
      ]);
      var data = await sbGet('articles', 'title=ilike.%25hello%25');
      assert.strictEqual(data.length, 2);
    });

    test('applies is filter', async function() {
      mockClient._setTableData('articles', [
        { id: 'a1', category: 'tech' },
        { id: 'a2', category: null }
      ]);
      var data = await sbGet('articles', 'category=is.null');
      assert.strictEqual(data.length, 1);
      assert.strictEqual(data[0].id, 'a2');
    });

    test('applies order', async function() {
      mockClient._setTableData('articles', [
        { id: 'a2', title: 'Second' },
        { id: 'a1', title: 'First' }
      ]);
      var data = await sbGet('articles', 'order=title.asc');
      assert.strictEqual(data[0].id, 'a1');
      assert.strictEqual(data[1].id, 'a2');
    });

    test('applies limit', async function() {
      mockClient._setTableData('articles', [
        { id: 'a1' }, { id: 'a2' }, { id: 'a3' }
      ]);
      var data = await sbGet('articles', 'limit=2');
      assert.strictEqual(data.length, 2);
    });

    test('applies select columns', async function() {
      mockClient._setTableData('articles', [
        { id: 'a1', title: 'Test', category: 'tech' }
      ]);
      var data = await sbGet('articles', 'select=id,title');
      assert.strictEqual(data[0].id, 'a1');
      assert.strictEqual(data[0].title, 'Test');
      assert.strictEqual(data[0].category, undefined);
    });

    test('applies multiple filters', async function() {
      mockClient._setTableData('articles', [
        { id: 'a1', category: 'tech', published: true },
        { id: 'a2', category: 'tech', published: false },
        { id: 'a3', category: 'business', published: true }
      ]);
      var data = await sbGet('articles', 'category=eq.tech&published=eq.true');
      assert.strictEqual(data.length, 1);
      assert.strictEqual(data[0].id, 'a1');
    });
  });

  describe('sbUpsert', function() {
    test('inserts new rows', async function() {
      mockClient._setTableData('articles', []);
      var data = await sbUpsert('articles', [
        { id: 'a1', title: 'New Article' }
      ]);
      assert.strictEqual(data.length, 1);
      var rows = mockClient._getTableData('articles');
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].title, 'New Article');
    });

    test('updates existing rows by id', async function() {
      mockClient._setTableData('articles', [
        { id: 'a1', title: 'Old Title' }
      ]);
      await sbUpsert('articles', [
        { id: 'a1', title: 'Updated Title' }
      ]);
      var rows = mockClient._getTableData('articles');
      assert.strictEqual(rows[0].title, 'Updated Title');
    });
  });

  describe('sbUpdate', function() {
    test('updates row by id', async function() {
      mockClient._setTableData('articles', [
        { id: 'a1', title: 'Old', category: 'tech' }
      ]);
      await sbUpdate('articles', 'a1', { title: 'Updated' });
      var rows = mockClient._getTableData('articles');
      assert.strictEqual(rows[0].title, 'Updated');
      assert.strictEqual(rows[0].category, 'tech');
    });
  });

  describe('sbDelete', function() {
    test('deletes by id', async function() {
      mockClient._setTableData('articles', [
        { id: 'a1' }, { id: 'a2' }
      ]);
      await sbDelete('articles', 'a1');
      var rows = mockClient._getTableData('articles');
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].id, 'a2');
    });

    test('deletes by filter (gt)', async function() {
      mockClient._setTableData('leads', [
        { id: 1 }, { id: 2 }, { id: 3 }
      ]);
      await sbDelete('leads', null, { op: 'gt', col: 'id', val: 0 });
      var rows = mockClient._getTableData('leads');
      assert.strictEqual(rows.length, 0);
    });
  });
});
