# LinkPulse

Minimal URL shortener with click analytics. Node.js + Express + SQLite (Node 24 built-in `node:sqlite` — no native deps).

## Features

- `POST /shorten` — shorten a URL, returns `{ shortUrl, code }`
- `GET /r/:code` — 301 redirect, records a click
- `GET /links` — all links with click counts
- `GET /stats/:code` — clicks per day, last 7 days (zero-filled)
- Single-page dark-mode dashboard (`frontend/index.html`), served by the backend
- 34 tests (unit + integration), Jest + Supertest

## Quick start

Requires Node.js >= 22.5 (built-in SQLite; recommended: Node 24 LTS).

```bash
cd backend
npm install
npm start
```

Open http://localhost:3000 — shorten links and watch click counts in the dashboard.

## Configuration

| Env var  | Default           | Purpose            |
| -------- | ----------------- | ------------------ |
| `PORT`   | `3000`            | HTTP port          |
| `DB_FILE`| `backend/data.db` | SQLite database file |

## API

```bash
# Shorten
curl -X POST http://localhost:3000/shorten \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com/some/long/url"}'
# => 201 {"shortUrl":"http://localhost:3000/r/Ab3xK9","code":"Ab3xK9"}

# Redirect (records a click)
curl -i http://localhost:3000/r/Ab3xK9     # 301 -> destination

# List links with click counts
curl http://localhost:3000/links

# Clicks per day, last 7 days
curl http://localhost:3000/stats/Ab3xK9
```

## Tests

```bash
cd backend
npm test
```

## Project layout

```
backend/
  src/
    server.js      # entry point (listen)
    app.js         # Express app + routes
    db.js          # SQLite schema (node:sqlite)
    shortener.js   # base62 code generation + URL validation
  tests/
    shortener.test.js   # code-gen unit tests
    api.test.js         # endpoint integration tests
frontend/
  index.html       # dashboard UI
design/
  links-dashboard.html  # static design prototype
DESIGN.md          # design system (tokens, components)
```

## Notes

- Short codes are 6-char base62, generated with `crypto.randomBytes` (modulo bias rejected).
- Only `http:` / `https:` URLs accepted.
- Click days are stored as UTC dates (`date('now')` in SQLite).
