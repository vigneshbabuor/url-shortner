'use strict';

const express = require('express');
const path = require('path');
const db = require('./db');
const { genCode, isValidUrl } = require('./shortener');

const app = express();
app.use(express.json());

// Serve the frontend (fixes CORS: page must load over http, not file://)
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

const insertLink = db.prepare('INSERT INTO links (code, url) VALUES (?, ?)');
const findLink = db.prepare('SELECT id, url FROM links WHERE code = ?');
const insertClick = db.prepare('INSERT INTO clicks (link_id) VALUES (?)');

app.post('/shorten', (req, res) => {
  const url = req.body && req.body.url;
  if (!isValidUrl(url)) return res.status(400).json({ error: 'invalid url' });

  let code = null;
  for (let attempt = 0; attempt < 5 && !code; attempt++) {
    const candidate = genCode();
    try {
      insertLink.run(candidate, url);
      code = candidate;
    } catch (err) {
      if (!/UNIQUE/i.test(err.message)) throw err;
    }
  }
  if (!code) return res.status(500).json({ error: 'could not allocate code' });

  res.status(201).json({ shortUrl: `${req.protocol}://${req.get('host')}/r/${code}`, code });
});

app.get('/r/:code', (req, res) => {
  const link = findLink.get(req.params.code);
  if (!link) return res.status(404).json({ error: 'not found' });
  insertClick.run(link.id);
  res.redirect(301, link.url);
});

app.get('/links', (req, res) => {
  res.json(
    db
      .prepare(
        `SELECT l.code, l.url, l.created_at AS createdAt, COUNT(c.id) AS clicks
         FROM links l LEFT JOIN clicks c ON c.link_id = l.id
         GROUP BY l.id
         ORDER BY l.created_at DESC, l.id DESC`
      )
      .all()
  );
});

app.get('/stats/:code', (req, res) => {
  const link = findLink.get(req.params.code);
  if (!link) return res.status(404).json({ error: 'not found' });

  res.json(
    db
      .prepare(
        `WITH RECURSIVE d(day) AS (
           SELECT date('now', '-6 days')
           UNION ALL SELECT date(day, '+1 day') FROM d WHERE day < date('now')
         )
         SELECT d.day AS day, IFNULL(c.clicks, 0) AS clicks
         FROM d LEFT JOIN (
           SELECT day, COUNT(*) AS clicks FROM clicks WHERE link_id = ? GROUP BY day
         ) c ON c.day = d.day
         ORDER BY d.day`
      )
      .all(link.id)
  );
});

module.exports = { app };
