const { prisma } = require('../helpers/dbQueryHelper');
const asyncHandler = require('../middleware/asyncHandler');
const respond = require('../helpers/respondHelper');

function serialize(obj) {
  if (typeof obj === 'bigint') return obj.toString();
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(serialize);
  if (obj !== null && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = serialize(v);
    return out;
  }
  return obj;
}

async function query(sql, ...params) {
  const rows = await prisma.$queryRawUnsafe(sql, ...params);
  return serialize(rows);
}

async function exec(sql, ...params) {
  return prisma.$executeRawUnsafe(sql, ...params);
}

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await exec(`
      CREATE TABLE IF NOT EXISTS auditlogs (
        id           BIGINT AUTO_INCREMENT PRIMARY KEY,
        module       VARCHAR(60)  NOT NULL,
        action       VARCHAR(60)  NOT NULL,
        entity_id    VARCHAR(60)  NULL,
        entity_name  VARCHAR(255) NULL,
        user_id      BIGINT       NULL,
        user_name    VARCHAR(200) NULL,
        ip_address   VARCHAR(60)  NULL,
        details      TEXT         NULL,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[auditController] Table ready');
  } catch (e) {
    console.error('[auditController] Setup error:', e.message);
  }
})();

// ── Log helper (fire-and-forget, safe to call without await) ──────────────────
async function logActivity({ module, action, entityId = null, entityName = null, userId = null, userName = null, ip = null, details = null } = {}) {
  try {
    await exec(
      `INSERT INTO auditlogs (module, action, entity_id, entity_name, user_id, user_name, ip_address, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      String(module),
      String(action),
      entityId != null ? String(entityId) : null,
      entityName != null ? String(entityName) : null,
      userId != null ? BigInt(userId) : null,
      userName != null ? String(userName) : null,
      ip != null ? String(ip) : null,
      details != null ? JSON.stringify(details) : null
    );
  } catch (e) {
    console.error('[audit log]', e.message);
  }
}

// Convenience: extract user info from an Express req object
function fromReq(req) {
  return {
    userId:   req.user?.id   ?? null,
    userName: req.user?.username ?? null,
    ip:       req.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? req.socket?.remoteAddress ?? null,
  };
}

// ── GET /audit-logs ───────────────────────────────────────────────────────────
const getAuditLogs = asyncHandler(async (req, res) => {
  const { module, user_id, date_from, date_to, search, page = '1', limit = '50' } = req.query;

  const conditions = [];
  const params = [];

  if (module)    { conditions.push('module = ?');              params.push(String(module)); }
  if (user_id)   { conditions.push('user_id = ?');             params.push(BigInt(user_id)); }
  if (date_from) { conditions.push('DATE(created_at) >= ?');   params.push(String(date_from)); }
  if (date_to)   { conditions.push('DATE(created_at) <= ?');   params.push(String(date_to)); }
  if (search)    {
    conditions.push('(entity_name LIKE ? OR user_name LIKE ? OR action LIKE ? OR module LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const pageNum  = Math.max(1, parseInt(page));
  const pageSize = Math.min(200, Math.max(1, parseInt(limit)));
  const offset   = (pageNum - 1) * pageSize;

  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM auditlogs ${where}`, ...params);
  const logs = await query(
    `SELECT id, module, action, entity_id, entity_name, user_id, user_name, ip_address, details, created_at
     FROM auditlogs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ...params, pageSize, offset
  );

  respond.ok(res, 'Audit logs retrieved', { logs, total: Number(total), page: pageNum, limit: pageSize });
});

// ── Distinct modules list (for filter dropdown) ───────────────────────────────
const getAuditModules = asyncHandler(async (_req, res) => {
  const rows = await query(`SELECT DISTINCT module FROM auditlogs ORDER BY module`);
  respond.ok(res, 'Modules', rows.map(r => r.module));
});

module.exports = { logActivity, fromReq, getAuditLogs, getAuditModules };
