'use strict';
const os = require('os');
const path = require('path');
const fs = require('fs');

// Isolated DB per test run, set BEFORE requiring the app.
const DB_FILE = path.join(os.tmpdir(), `linkpulse-it-${process.pid}-${Date.now()}.db`);
process.env.DB_FILE = DB_FILE;

const request = require('supertest');
const { app } = require('../src/app');
const db = require('../src/db');

afterAll(() => {
  db.close();
  for (const f of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`]) fs.rmSync(f, { force: true });
});

const shorten = url => request(app).post('/shorten').send({ url });

describe('POST /shorten', () => {
  test('201 with shortUrl + base62 code', async () => {
    const res = await shorten('https://example.com/a');
    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(/^[0-9A-Za-z]{6}$/);
    expect(res.body.shortUrl).toMatch(new RegExp(`^http://127\\.0\\.0\\.1:\\d+/r/${res.body.code}$`));
  });

  test('persists the link row', async () => {
    const { body } = await shorten('https://example.com/persist');
    const row = db.prepare('SELECT url FROM links WHERE code = ?').get(body.code);
    expect(row.url).toBe('https://example.com/persist');
  });

  test('400 on invalid url', async () => {
    const res = await shorten('not-a-url');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid url');
  });

  test('400 on missing / wrong-typed url', async () => {
    expect((await request(app).post('/shorten').send({})).status).toBe(400);
    expect((await request(app).post('/shorten').send({ url: 123 })).status).toBe(400);
  });

  test('400 on javascript: scheme', async () => {
    expect((await shorten('javascript:alert(1)')).status).toBe(400);
  });
});

describe('GET /r/:code', () => {
  test('301 to destination with Location header', async () => {
    const { body } = await shorten('https://example.com/redirect-target');
    const res = await request(app).get(`/r/${body.code}`).redirects(0);
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('https://example.com/redirect-target');
  });

  test('increments click counter per hit', async () => {
    const { body } = await shorten('https://example.com/count');
    for (let i = 0; i < 3; i++) await request(app).get(`/r/${body.code}`).redirects(0);
    const row = db.prepare('SELECT COUNT(*) AS n FROM clicks WHERE link_id = (SELECT id FROM links WHERE code = ?)').get(body.code);
    expect(row.n).toBe(3);
  });

  test('404 unknown code, no click recorded', async () => {
    const before = db.prepare('SELECT COUNT(*) AS n FROM clicks').get().n;
    const res = await request(app).get('/r/zzzzzz');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not found');
    expect(db.prepare('SELECT COUNT(*) AS n FROM clicks').get().n).toBe(before);
  });
});

describe('GET /links', () => {
  test('lists links newest-first with click counts (incl. zero)', async () => {
    const a = (await shorten('https://example.com/link-a')).body;
    const b = (await shorten('https://example.com/link-b')).body;
    await request(app).get(`/r/${a.code}`).redirects(0);
    await request(app).get(`/r/${a.code}`).redirects(0);

    const res = await request(app).get('/links');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const ra = res.body.find(r => r.code === a.code);
    const rb = res.body.find(r => r.code === b.code);
    expect(ra).toMatchObject({ url: 'https://example.com/link-a', clicks: 2 });
    expect(rb.clicks).toBe(0);
    expect(ra.createdAt).toBeTruthy();
    expect(res.body[0].code).toBe(b.code); // newest first
  });

  test('shape is exactly {code,url,createdAt,clicks}', async () => {
    const res = await request(app).get('/links');
    expect(Object.keys(res.body[0]).sort()).toEqual(['clicks', 'code', 'createdAt', 'url']);
  });
});

describe('GET /stats/:code', () => {
  test('7 ascending days ending today, zero-filled, counts today', async () => {
    const { body } = await shorten('https://example.com/stats');
    await request(app).get(`/r/${body.code}`).redirects(0);
    await request(app).get(`/r/${body.code}`).redirects(0);

    const res = await request(app).get(`/stats/${body.code}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(7);

    const days = res.body.map(d => d.day);
    for (let i = 0; i < 6; i++) expect(days[i] < days[i + 1]).toBe(true);
    expect(days[6]).toBe(new Date().toISOString().slice(0, 10));
    expect(res.body[6].clicks).toBe(2);
    expect(res.body.slice(0, 6).every(d => d.clicks === 0)).toBe(true);
  });

  test('link with no clicks returns 7 zero days', async () => {
    const { body } = await shorten('https://example.com/no-clicks');
    const res = await request(app).get(`/stats/${body.code}`);
    expect(res.body).toHaveLength(7);
    expect(res.body.every(d => d.clicks === 0)).toBe(true);
  });

  test('404 unknown code', async () => {
    const res = await request(app).get('/stats/nonono');
    expect(res.status).toBe(404);
  });
});
