'use strict';

const path = require('path');
// ponytail: node:sqlite (Node 24 stdlib) instead of better-sqlite3 — native build
// needs a compiler the sandbox blocks. Same prepare/run/get/all surface.
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(process.env.DB_FILE || path.join(__dirname, '..', 'data.db'));

db.exec('PRAGMA journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id INTEGER NOT NULL REFERENCES links(id),
  day TEXT DEFAULT (date('now'))
);
CREATE INDEX IF NOT EXISTS idx_clicks_link_day ON clicks(link_id, day);
`);

module.exports = db;
