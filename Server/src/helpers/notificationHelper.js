// In-app notification helpers. All functions are best-effort and never throw into
// the request flow — a notification failure must never break the underlying action.
//
// The `notifications` table stores one row per recipient user:
//   toUser (users.id), fromUser, fromEmployee, employee, message, action, type, status
// `action` holds an App activeView key so the bell can navigate on click.

const { prisma } = require('./dbQueryHelper');

const big = (v) => {
  try { return v === null || v === undefined || v === '' ? null : BigInt(v); }
  catch { return null; }
};

// Insert one notification row.
async function createNotification({ toUser, fromUser = null, fromEmployee = null, employee = null, message, action = null, type = null }) {
  const to = big(toUser);
  if (!to) return;
  try {
    await prisma.notifications.create({
      data: {
        toUser: to,
        fromUser:     big(fromUser),
        fromEmployee: big(fromEmployee),
        employee:     big(employee),
        message:      message ?? null,
        action:       action ?? null,
        type:         type ?? null,
        status:       'Unread',
        time:         new Date(),
      },
    });
  } catch (err) {
    console.error('createNotification failed:', err.message);
  }
}

// Notify the user account linked to an employee record (skips people with no login).
async function notifyEmployee(employeeId, payload = {}) {
  const empId = big(employeeId);
  if (!empId) return;
  try {
    const rows = await prisma.$queryRaw`SELECT id FROM users WHERE employeeId = ${empId} LIMIT 1`;
    if (!rows.length) return;
    await createNotification({ toUser: rows[0].id, employee: empId, ...payload });
  } catch (err) {
    console.error('notifyEmployee failed:', err.message);
  }
}

// Notify a specific user id directly.
async function notifyUser(userId, payload = {}) {
  await createNotification({ toUser: userId, ...payload });
}

// Notify every active user holding `permission` (via role grants or direct grants),
// excluding the actor so people aren't pinged about their own action.
async function notifyUsersWithPermission(permission, payload = {}, exceptUserId = null) {
  try {
    const rows = await prisma.$queryRaw`
      SELECT DISTINCT mhr.model_id AS userId
         FROM permissions p
         JOIN role_has_permissions rhp ON rhp.permission_id = p.id
         JOIN roles r ON r.id = rhp.role_id AND r.status = '1'
         JOIN model_has_roles mhr ON mhr.role_id = r.id AND mhr.model_type = 'users'
        WHERE p.name = ${permission}
       UNION
       SELECT DISTINCT mhp.model_id AS userId
         FROM permissions p
         JOIN model_has_permissions mhp ON mhp.permission_id = p.id AND mhp.model_type = 'users'
        WHERE p.name = ${permission}`;
    const except = exceptUserId === null || exceptUserId === undefined ? null : String(exceptUserId);
    for (const row of rows) {
      if (except !== null && String(row.userId) === except) continue;
      await createNotification({ toUser: row.userId, ...payload });
    }
  } catch (err) {
    console.error('notifyUsersWithPermission failed:', err.message);
  }
}

module.exports = { createNotification, notifyEmployee, notifyUser, notifyUsersWithPermission };
