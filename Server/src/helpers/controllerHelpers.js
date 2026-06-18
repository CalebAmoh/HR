const { prisma } = require('./dbQueryHelper');

// Recursively convert BigInt / Date / Prisma Decimal to JSON-safe primitives.
// Handles three Decimal shapes:
//   • Prisma.Decimal class instance (constructor.name === 'Decimal')
//   • Decimal.js plain-object { s, e, d } produced by JSON round-trip
//   • Legacy toFixed-duck-typed objects (older Prisma builds)
function serialize(obj) {
  if (typeof obj === 'bigint') return obj.toString();
  if (obj instanceof Date)     return obj.toISOString();
  if (Array.isArray(obj))      return obj.map(serialize);
  if (obj !== null && typeof obj === 'object') {
    if (obj.constructor?.name === 'Decimal') return parseFloat(obj.toString());
    if (
      typeof obj.s === 'number' &&
      typeof obj.e === 'number' &&
      Array.isArray(obj.d) && obj.d.length > 0
    ) {
      // decimal.js shape: value = sign × 0.<digit groups> × 10^(e+1)
      // (first group unpadded, subsequent groups zero-padded to 7 digits)
      const digits = obj.d.map((g, i) => i === 0 ? String(g) : String(g).padStart(7, '0')).join('');
      const num    = (obj.s < 0 ? -1 : 1) * parseFloat(`0.${digits}`) * Math.pow(10, obj.e + 1);
      return isNaN(num) ? null : num;
    }
    if (typeof obj.toFixed === 'function') return parseFloat(obj.toString());
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = serialize(v);
    return out;
  }
  return obj;
}

// Short alias used throughout most controllers
const s = serialize;

// Convert any value to BigInt; returns null on failure or falsy input (except 0)
function toBigInt(val) {
  if (!val && val !== 0) return null;
  try { return BigInt(val); } catch { return null; }
}

// Run an ALTER TABLE statement quietly — ignores duplicate-column and similar schema-patch errors
async function safeAlter(sql) {
  try { await prisma.$executeRawUnsafe(sql); } catch {}
}

module.exports = { serialize, s, toBigInt, safeAlter };
