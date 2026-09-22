'use strict';

const crypto = require('crypto');

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const LIMIT = 248; // 62 * 4, reject bytes >= LIMIT so modulo stays unbiased

function genCode(len = 6) {
  let out = '';
  while (out.length < len) {
    for (const b of crypto.randomBytes(len)) {
      if (b < LIMIT) out += ALPHABET[b % 62];
      if (out.length === len) break;
    }
  }
  return out;
}

function isValidUrl(raw) {
  if (typeof raw !== 'string') return false;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

module.exports = { genCode, isValidUrl };
