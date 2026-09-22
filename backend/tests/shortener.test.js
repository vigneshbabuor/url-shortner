'use strict';
const { genCode, isValidUrl } = require('../src/shortener');

describe('genCode', () => {
  test('returns 6 chars by default, honors explicit length', () => {
    expect(genCode()).toHaveLength(6);
    expect(genCode(10)).toHaveLength(10);
    expect(genCode(1)).toHaveLength(1);
  });

  test('base62 alphabet only', () => {
    for (let i = 0; i < 300; i++) expect(genCode()).toMatch(/^[0-9A-Za-z]{6}$/);
  });

  test('unbiased-ish distribution over many draws', () => {
    const counts = {};
    for (let i = 0; i < 3000; i++) {
      const c = genCode()[0];
      counts[c] = (counts[c] || 0) + 1;
    }
    // 3000 draws over 62 symbols => ~48 each; allow wide band, catches constant output
    const vals = Object.values(counts);
    expect(vals.length).toBeGreaterThan(40);
    expect(Math.max(...vals)).toBeLessThan(120);
  });

  test('collisions rare (500 draws)', () => {
    expect(new Set(Array.from({ length: 500 }, () => genCode())).size).toBeGreaterThan(490);
  });
});

describe('isValidUrl', () => {
  test.each([
    'http://example.com',
    'https://example.com/path?q=1&r=2',
    'https://sub.domain.io/x#frag',
    'https://example.com:8443/port'
  ])('accepts %s', u => expect(isValidUrl(u)).toBe(true));

  test.each([
    'ftp://example.com',
    'javascript:alert(1)',
    'data:text/html,x',
    'file:///etc/passwd',
    'example.com',
    'not a url',
    '',
    '   ',
    null,
    undefined,
    42,
    {},
    ['https://example.com']
  ])('rejects %p', u => expect(isValidUrl(u)).toBe(false));
});
