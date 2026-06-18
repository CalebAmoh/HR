const crypto = require('crypto');
const helper = require('../helpers/dbQueryHelper');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const asyncHandler = require('../middleware/asyncHandler');
const respond = require('../helpers/respondHelper');
const { sendWelcomeEmail } = require('../helpers/emailHelper');
const { logActivity, fromReq } = require('./auditController');



// ─────────────────────────────────────────────
// @desc    Register a new user
// @route   POST /register
// @access  Private (Admin only)
// ─────────────────────────────────────────────
const registerUser = asyncHandler(async (req, res) => {
  const {
    employeeId,               // required — CUID of the existing employee record
    username,
    firstname, middlename, lastname, phone, email,
    status = '1', posted_by = 0,
    roles = [], permissions = [],
  } = req.body;

  // employeeId and username are required
  const validation = helper.checkForNullOrEmpty([
    { name: 'Employee',  value: employeeId },
    { name: 'Username',  value: username },
  ]);
  if (validation.status === 'error') {
    return res.status(400).json({ status: '400', message: validation.message });
  }

  // At least one role must be provided
  if (!Array.isArray(roles) || roles.length === 0) {
    return res.status(400).json({ status: '400', message: 'At least one role is required' });
  }

  // Verify the employee exists
  const empCheck = await helper.selectRecordsWithQuery(
    `SELECT id FROM employee WHERE id = ? LIMIT 1`,
    [employeeId]
  );
  if (!empCheck.data?.length) {
    return res.status(404).json({ status: '404', message: 'Employee not found' });
  }

  // Ensure no account already exists for this employee
  const dupCheck = await helper.selectRecordsWithQuery(
    `SELECT id FROM users WHERE employeeId = ? LIMIT 1`,
    [employeeId]
  );
  if (dupCheck.data?.length) {
    return res.status(409).json({ status: '409', message: 'A user account already exists for this employee' });
  }

  // Validate role IDs
  const rolePlaceholders = roles.map(() => '?').join(',');
  const rolesCheck = await helper.selectRecordsWithQuery(
    `SELECT id FROM roles WHERE id IN (${rolePlaceholders})`,
    roles
  );
  if (!rolesCheck.data || rolesCheck.data.length !== roles.length) {
    return res.status(400).json({ status: '400', message: 'One or more role IDs are invalid' });
  }

  // Validate permission IDs (if any)
  if (permissions.length > 0) {
    const permPlaceholders = permissions.map(() => '?').join(',');
    const permsCheck = await helper.selectRecordsWithQuery(
      `SELECT id FROM permissions WHERE id IN (${permPlaceholders})`,
      permissions
    );
    if (!permsCheck.data || permsCheck.data.length !== permissions.length) {
      return res.status(400).json({ status: '400', message: 'One or more permission IDs are invalid' });
    }
  }

  // Optionally update employee profile fields if provided
  const empUpdate = {};
  if (firstname)     empUpdate.firstName     = firstname;
  if (middlename)    empUpdate.middleName     = middlename;
  if (lastname)      empUpdate.lastName       = lastname;
  if (phone)         empUpdate.phone          = phone;
  if (email)         empUpdate.email          = email;

  if (Object.keys(empUpdate).length > 0) {
    await helper.dynamicUpdateWithId('employee', empUpdate, employeeId);
  }

  // Fetch employee email for welcome email
  const empData = await helper.selectRecordsWithQuery(
    `SELECT CONCAT_WS(' ', firstName, lastName) AS name, work_email, email FROM employee WHERE id = ? LIMIT 1`,
    [employeeId]
  );
  const emp = empData.data?.[0] ?? {};
  const recipientEmail = emp.work_email || emp.email;

  // Generate random password
  const plainPassword  = crypto.randomBytes(8).toString('hex');
  const salt           = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(plainPassword, salt);

  // Create the users record (only valid columns)
  const result = await helper.dynamicInsert('users', {
    employeeId,
    username:   username || email,
    password:   hashedPassword,
    posted_by,
    status,
  });
  if (result.status === 'error') {
    return res.status(500).json({ status: '500', message: result.message });
  }

  const newUserId = result.data.id;

  // Assign roles
  for (const roleId of roles) {
    await helper.selectRecordsWithQuery(
      `INSERT INTO model_has_roles (role_id, model_id, model_type) VALUES (?, ?, 'users')`,
      [roleId, String(newUserId)]
    );
  }

  // Assign direct permissions
  for (const permissionId of permissions) {
    await helper.selectRecordsWithQuery(
      `INSERT INTO model_has_permissions (permission_id, model_id, model_type) VALUES (?, ?, 'users')`,
      [permissionId, String(newUserId)]
    );
  }

  // Send welcome email (non-blocking — don't fail registration if email fails)
  if (recipientEmail) {
    sendWelcomeEmail({
      to:       recipientEmail,
      name:     emp.name || username,
      username: username || email,
      password: plainPassword,
    }).catch((err) => console.error('Welcome email failed:', err.message));
  }

  // Return the new user with employee profile
  const newUser = await helper.selectRecordsWithQuery(`
    SELECT u.id, u.status, u.username, u.employeeId,
           e.email, e.firstName, e.lastName, e.middleName, e.phone
    FROM users u
    JOIN employee e ON e.id = u.employeeId
    WHERE u.id = ?
    LIMIT 1
  `, [newUserId]);

  const userData = newUser.data?.[0] ?? {};
  logActivity({ module: 'Users', action: 'create', entityId: String(newUserId), entityName: userData.username || username, ...fromReq(req) });
  res.status(201).json({ status: '201', message: 'User registered successfully', data: userData });
});


// ─────────────────────────────────────────────
// @desc    Login user
// @route   POST /login
// @access  Public
// ─────────────────────────────────────────────
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validate fields
  const validation = helper.checkForNullOrEmpty([
    { name: 'Email or username', value: email },
    { name: 'Password',          value: password },
  ]);
  if (validation.status === 'error') {
    return res.status(400).json({ status: '400', message: validation.message });
  }

  // Find user by username OR employee email (LEFT JOIN so username-only accounts still match)
  const userResult = await helper.selectRecordsWithQuery(`
    SELECT u.id, u.username, u.password, u.status, u.employeeId, u.theme,
           e.email, e.firstName, e.lastName, e.phone
    FROM users u
    LEFT JOIN employee e ON e.id = u.employeeId
    WHERE u.username = ? OR e.email = ? OR e.work_email = ?
    LIMIT 1
  `, [email, email, email]);
  if (userResult.status === 'error' || !userResult.data?.length) {
    return res.status(401).json({ status: '401', message: 'Invalid email or password' });
  }

  const user = userResult.data[0];

  // Check if account is active
  if (user.status !== '1') {
    return res.status(403).json({ status: '403', message: 'Account is deactivated. Contact administrator.' });
  }

  // Compare password
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ status: '401', message: 'Invalid email or password' });
  }

  // ── Fetch roles ────────────────────────────────────────
  // Only ACTIVE roles grant access — a deactivated role contributes no permissions until reactivated.
  const rolesResult = await helper.selectRecordsWithQuery(`
    SELECT r.id, r.name
    FROM roles r
    INNER JOIN model_has_roles mhr ON mhr.role_id = r.id
    WHERE mhr.model_id = ? AND mhr.model_type = 'users' AND r.status = '1'
    ORDER BY r.name ASC
  `, [user.id]);

  const roles = rolesResult.data ?? [];

  // ── Fetch permissions from roles ───────────────────────
  let permissionsFromRoles = [];
  if (roles.length > 0) {
    const placeholders = roles.map(() => '?').join(',');
    const rolePermsResult = await helper.selectRecordsWithQuery(`
      SELECT DISTINCT p.id, p.name
      FROM permissions p
      INNER JOIN role_has_permissions rhp ON rhp.permission_id = p.id
      WHERE rhp.role_id IN (${placeholders})
      ORDER BY p.name ASC
    `, roles.map(r => r.id));

    permissionsFromRoles = rolePermsResult.data ?? [];
  }

  // ── Fetch direct permissions assigned to user ──────────
  const directPermsResult = await helper.selectRecordsWithQuery(`
    SELECT DISTINCT p.id, p.name
    FROM permissions p
    INNER JOIN model_has_permissions mhp ON mhp.permission_id = p.id
    WHERE mhp.model_id = ? AND mhp.model_type = 'users'
    ORDER BY p.name ASC
  `, [user.id]);

  const directPermissions = directPermsResult.data ?? [];

  // ── Merge and deduplicate all permissions ──────────────
  const permissionMap = new Map();
  [...permissionsFromRoles, ...directPermissions].forEach(p => {
    permissionMap.set(p.id.toString(), p.name);
  });
  const allPermissions = Array.from(permissionMap.values()).sort();

  // ── Generate tokens ────────────────────────────────────
  const accessToken = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user.id, email: user.email },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' }
  );

  // ── Store refresh token in DB ──────────────────────────
  const refreshTokenExpiry = new Date();
  refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);

  await helper.dynamicInsert('refresh_tokens', {
    user_id:    user.id,
    token:      refreshToken,
    expires_at: refreshTokenExpiry,
    revoked:    false,
  });

  // ── Send refresh token as httpOnly cookie ──────────────
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   7 * 24 * 60 * 60 * 1000,
  });

  const { password: _, ...userWithoutPassword } = user;

  res.status(200).json({
    status:  '200',
    message: 'Login successful',
    accessToken,
    data: {
      ...userWithoutPassword,
      userType:    userWithoutPassword.employeeId ? 'employee' : 'admin',
      roles:       roles.map(r => r.name),
      permissions: allPermissions,
    },
  });
});


// ─────────────────────────────────────────────
// @desc    Logout user — revoke refresh token
// @route   POST /logout
// @access  Private
// ─────────────────────────────────────────────
const logoutUser = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  if (refreshToken) {
    // Revoke the token in the DB
    const tokenResult = await helper.selectRecordsWithCondition('refresh_tokens', {
      token: refreshToken,
    });

    if (tokenResult.status === 'success' && tokenResult.data.length > 0) {
      await helper.dynamicUpdateWithId(
        'refresh_tokens',
        { revoked: true },
        tokenResult.data[0].id
      );
    }
  }

  // Clear the cookie regardless
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });

  res.status(200).json({ status: '200', message: 'Logged out successfully' });
});


// ─────────────────────────────────────────────
// @desc    Get all users (with their roles)
// @route   GET /
// @access  Private (Admin only)
// ─────────────────────────────────────────────
const getAllUsers = asyncHandler(async (req, res) => {
   const result = await helper.selectRecordsWithQuery(`
  SELECT
    u.id,
    u.username,
    u.employeeId,
    u.status,
    u.posted_by,
    e.firstName,
    e.lastName,
    e.middleName,
    CONCAT_WS(' ', e.firstName, e.lastName) AS name,
    e.phone,
    e.email,

    -- Roles as JSON array
    CONCAT(
      '[',
      IFNULL(
        GROUP_CONCAT(
          DISTINCT CONCAT('"', r.name, '"')
          ORDER BY r.name
          SEPARATOR ','
        ),
        ''
      ),
      ']'
    ) AS roles,

    -- Direct permissions as JSON array
    CONCAT(
      '[',
      IFNULL(
        GROUP_CONCAT(
          DISTINCT CONCAT('"', p.name, '"')
          ORDER BY p.name
          SEPARATOR ','
        ),
        ''
      ),
      ']'
    ) AS direct_permissions

  FROM users u
  JOIN employee e ON e.id = u.employeeId

  LEFT JOIN model_has_roles mhr
    ON mhr.model_id = u.id
    AND mhr.model_type = 'users'

  LEFT JOIN roles r
    ON r.id = mhr.role_id

  LEFT JOIN model_has_permissions mhp
    ON mhp.model_id = u.id
    AND mhp.model_type = 'users'

  LEFT JOIN permissions p
    ON p.id = mhp.permission_id

  WHERE u.status IN ('1', '0')

  GROUP BY
    u.id,
    u.username,
    u.employeeId,
    u.status,
    u.posted_by,
    e.firstName,
    e.lastName,
    e.middleName,
    e.phone,
    e.email
`);

  if (result.status === 'error') {
    console.error('Database error:', result.message);
    return res.status(404).json({ status: '404', message: 'No users found', data: [] });
  }

  res.status(200).json({
    status:  '200',
    message: 'Users retrieved successfully',
    count:   result.count,
    data:    result.data,
  });
});


// ─────────────────────────────────────────────
// @desc    Get single user by ID 
//          → includes roles + permissions per role
//          → includes direct permissions assigned to user
// @route   GET /:id
// @access  Private
// ─────────────────────────────────────────────
const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await helper.selectRecordsWithQuery(`
    SELECT
      u.id,
      u.username,
      u.employeeId,
      u.status,
      u.posted_by,
      e.firstName,
      e.middleName,
      e.lastName,
      CONCAT_WS(' ', e.firstName, e.lastName) AS name,
      e.phone,
      e.email,

      -- Roles + permissions per role (subquery)
      COALESCE(
        (SELECT CONCAT('[',
          GROUP_CONCAT(
            DISTINCT CONCAT(
              '{',
              '"name":"', REPLACE(r.name, '"', '\\"'), '",',
              '"id":', r.id, ',',
              '"permissions":[',
                COALESCE(
                  (SELECT GROUP_CONCAT(
                     DISTINCT CONCAT('"', REPLACE(p.name, '"', '\\"'), '"')
                     ORDER BY p.name SEPARATOR ','
                   )
                   FROM role_has_permissions rhp
                   JOIN permissions p ON p.id = rhp.permission_id
                   WHERE rhp.role_id = r.id),
                  ''
                ),
              ']',
              '}'
            )
            ORDER BY r.name SEPARATOR ','
          ),
        ']')
        FROM model_has_roles mhr
        JOIN roles r ON r.id = mhr.role_id
        WHERE mhr.model_id = u.id AND mhr.model_type = 'users'
        ),
        '[]'
      ) AS roles_json,

      -- Direct permissions (separate subquery)
      COALESCE(
        (SELECT CONCAT('[',
          GROUP_CONCAT(
            DISTINCT CONCAT('"', REPLACE(p.name, '"', '\\"'), '"')
            ORDER BY p.name SEPARATOR ','
          ),
        ']')
        FROM model_has_permissions mhp
        JOIN permissions p ON p.id = mhp.permission_id
        WHERE mhp.model_id = u.id AND mhp.model_type = 'users'
        ),
        '[]'
      ) AS direct_permissions_json

    FROM users u
    JOIN employee e ON e.id = u.employeeId
    WHERE u.id = ?
  `, [id]);

  if (result.status === 'error' || !result.data?.length) {
    return res.status(404).json({ status: '404', message: 'User not found' });
  }

  const user = result.data[0];

  let roles = [];
  let directPermissions = [];

  try {
    roles = JSON.parse(user.roles_json || '[]');
    directPermissions = JSON.parse(user.direct_permissions_json || '[]');
  } catch (err) {
    console.error('JSON parse error:', err);
  }

  delete user.roles_json;
  delete user.direct_permissions_json;

  res.status(200).json({
    status: '200',
    message: 'User retrieved successfully',
    data: {
      ...user,
      roles,
      direct_permissions: directPermissions
    }
  });
});


// ─────────────────────────────────────────────
// @desc    Update user
// @route   PUT /:id
// @access  Private
// ─────────────────────────────────────────────
const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    firstname,
    middlename,
    lastname,
    phone,
    email,
    status,
    roles,
    permissions,
    posted_by,
    username,
  } = req.body;

  // ───────────────────────────
  // Check user exists (get employeeId for subsequent employee update)
  // ───────────────────────────
  const existing = await helper.selectRecordsWithCondition('users', { id });
  if (existing.status === 'error' || existing.data.length === 0) {
    return res.status(404).json({ status: '404', message: 'User not found' });
  }
  const { employeeId } = existing.data[0];

  // ───────────────────────────
  // Check email/phone conflict on employee table
  // ───────────────────────────
  if (email || phone) {
    const conflict = await helper.selectRecordsWithQuery(
      `SELECT id FROM employee WHERE (email = ? OR phone = ?) AND id != ?`,
      [email ?? '', phone ?? '', employeeId]
    );
    if (conflict.data && conflict.data.length > 0) {
      return res.status(409).json({ status: '409', message: 'Email or phone already in use by another employee' });
    }
  }

  // ───────────────────────────
  // Update employee profile fields
  // ───────────────────────────
  const employeeData = {};
  if (firstname)     employeeData.firstName     = firstname;
  if (middlename)    employeeData.middleName     = middlename;
  if (lastname)      employeeData.lastName       = lastname;
  if (phone)         employeeData.phone          = phone;
  if (email)         employeeData.email          = email;

  if (Object.keys(employeeData).length > 0) {
    const empResult = await helper.dynamicUpdateWithId('employee', employeeData, employeeId);
    if (empResult.status === 'error') {
      return res.status(500).json({ status: '500', message: empResult.message });
    }
  }

  // ───────────────────────────
  // Update users-only fields (status, username, posted_by)
  // ───────────────────────────
  const userData = {};
  if (status !== undefined && status !== null) userData.status    = status;
  if (username)                                userData.username  = username;
  if (posted_by)                               userData.posted_by = posted_by;

  if (Object.keys(userData).length > 0) {
    const result = await helper.dynamicUpdateWithId('users', userData, id);
    if (result.status === 'error') {
      return res.status(500).json({ status: '500', message: result.message });
    }
  }

  // ───────────────────────────
  // 🔥 SYNC ROLES
  // ───────────────────────────
  if (Array.isArray(roles)) {

    // Validate roles exist
    if (roles.length > 0) {
      const placeholders = roles.map(() => '?').join(',');
      const roleCheck = await helper.selectRecordsWithQuery(
        `SELECT id FROM roles WHERE id IN (${placeholders})`,
        roles
      );

      if (!roleCheck.data || roleCheck.data.length !== roles.length) {
        return res.status(400).json({
          status: '400',
          message: 'One or more role IDs are invalid'
        });
      }
    }

    // Remove existing roles
    await helper.selectRecordsWithQuery(
      `DELETE FROM model_has_roles WHERE model_id = ? AND model_type = 'users'`,
      [id]
    );

    // Insert new roles
    for (const roleId of roles) {
      await helper.selectRecordsWithQuery(
        `INSERT INTO model_has_roles (role_id, model_id, model_type) VALUES (?, ?, 'users')`,
        [roleId, String(id)]
      );
    }
  }

  // ───────────────────────────
  // 🔥 SYNC DIRECT PERMISSIONS
  // ───────────────────────────
  if (Array.isArray(permissions)) {

    if (permissions.length > 0) {
      const placeholders = permissions.map(() => '?').join(',');
      const permCheck = await helper.selectRecordsWithQuery(
        `SELECT id FROM permissions WHERE id IN (${placeholders})`,
        permissions
      );

      if (!permCheck.data || permCheck.data.length !== permissions.length) {
        return res.status(400).json({
          status: '400',
          message: 'One or more permission IDs are invalid'
        });
      }
    }

    // Remove existing direct permissions
    await helper.selectRecordsWithQuery(
      `DELETE FROM model_has_permissions WHERE model_id = ? AND model_type = 'users'`,
      [id]
    );

    // Insert new permissions
    for (const permissionId of permissions) {
      await helper.selectRecordsWithQuery(
        `INSERT INTO model_has_permissions (permission_id, model_id, model_type) VALUES (?, ?, 'users')`,
        [permissionId, String(id)]
      );
    }
  }

  // ───────────────────────────
  // Return updated user
  // ───────────────────────────
  const updatedUser = await helper.selectRecordsWithQuery(`
    SELECT u.id, u.status, u.username, u.employeeId,
           e.email, e.firstName, e.lastName, e.middleName, e.phone
    FROM users u
    JOIN employee e ON e.id = u.employeeId
    WHERE u.id = ?
    LIMIT 1
  `, [id]);

  if (!updatedUser.data?.length) {
    return res.status(404).json({ status: '404', message: 'User not found after update' });
  }

  res.status(200).json({
    status:  '200',
    message: 'User updated successfully',
    data:    updatedUser.data[0],
  });
});


// ─────────────────────────────────────────────
// @desc    Change password
// @route   PUT /:id/change-password
// @access  Private
// ─────────────────────────────────────────────
const changePassword = asyncHandler(async (req, res) => {
  const id = req.params.id ?? req.user?.id;
  const { currentPassword, newPassword } = req.body;

  const isSelf = String(id) === String(req.user.id);
  const isAdmin = req.user.roles.includes('super-admin') || req.user.roles.includes('admin') || req.user.permissions.includes('change_user_password');

  if (isSelf) {
    const validation = helper.checkForNullOrEmpty([
      { name: 'Current Password', value: currentPassword },
      { name: 'New Password',     value: newPassword },
    ]);
    if (validation.status === 'error') {
      return res.status(400).json({ status: '400', message: validation.message });
    }
    // Prevent reusing the same password
    if (currentPassword === newPassword) {
      return res.status(400).json({ status: '400', message: 'New password must be different from current password' });
    }
  } else {
    // Admin resetting someone else's password
    if (!isAdmin) {
      return res.status(403).json({ status: '403', message: 'Unauthorized to change this user\'s password' });
    }
    const validation = helper.checkForNullOrEmpty([
      { name: 'New Password',     value: newPassword },
    ]);
    if (validation.status === 'error') {
      return res.status(400).json({ status: '400', message: validation.message });
    }
  }

  // Get user with password
  const userResult = await helper.selectRecordsWithCondition('users', { id: id });
  if (userResult.status === 'error' || userResult.data.length === 0) {
    return res.status(404).json({ status: '404', message: 'User not found' });
  }

  const user = userResult.data[0];

  if (isSelf) {
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ status: '401', message: 'Current password is incorrect' });
    }
  }

  // Hash and save new password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  const result = await helper.dynamicUpdateWithId('users', { password: hashedPassword }, id);
  if (result.status === 'error') {
    return res.status(500).json({ status: '500', message: result.message });
  }

  // Revoke all existing refresh tokens so user must log in again
  await helper.prisma.refresh_tokens.updateMany({
    where:  { user_id: id, revoked: false },
    data:   { revoked: true },
  });

  res.status(200).json({ status: '200', message: 'Password changed successfully. Please log in again.' });
});


// ─────────────────────────────────────────────
// @desc    Deactivate user (soft delete)
// @route   PUT /:id/deactivate
// @access  Private (Admin only)
// ─────────────────────────────────────────────
const deactivateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existing = await helper.selectRecordsWithCondition('users', { id: id });
  if (existing.status === 'error' || existing.data.length === 0) {
    return res.status(404).json({ status: '404', message: 'User not found' });
  }

  if (existing.data[0].status === '0') {
    return res.status(409).json({ status: '409', message: 'User is already deactivated' });
  }

  const result = await helper.dynamicUpdateWithId('users', { status: '0' }, id);
  if (result.status === 'error') {
    return res.status(500).json({ status: '500', message: result.message });
  }

  // Revoke all refresh tokens for this user
  await helper.prisma.refresh_tokens.updateMany({
    where: { user_id: id, revoked: false },
    data:  { revoked: true },
  });

  logActivity({ module: 'Users', action: 'deactivate', entityId: String(id), entityName: existing.data[0].username, ...fromReq(req) });
  res.status(200).json({ status: '200', message: 'User deactivated successfully' });
});


// ─────────────────────────────────────────────
// @desc    Reactivate user
// @route   PUT /:id/activate
// @access  Private (Admin only)
// ─────────────────────────────────────────────
const activateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existing = await helper.selectRecordsWithCondition('users', { id: id });
  if (existing.status === 'error' || existing.data.length === 0) {
    return res.status(404).json({ status: '404', message: 'User not found' });
  }

  if (existing.data[0].status === '1') {
    return res.status(409).json({ status: '409', message: 'User is already active' });
  }

  const result = await helper.dynamicUpdateWithId('users', { status: '1' }, id);
  if (result.status === 'error') {
    return res.status(500).json({ status: '500', message: result.message });
  }

  logActivity({ module: 'Users', action: 'activate', entityId: String(id), entityName: existing.data[0].username, ...fromReq(req) });
  res.status(200).json({ status: '200', message: 'User activated successfully' });
});



// ─────────────────────────────────────────────
// @desc    Activate or deactivate a role (kept for backwards compat)
// @route   PUT /api/roles/:id/status
// @access  Admin
// ─────────────────────────────────────────────
const updateUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validation = helper.checkForNullOrEmpty([
    { name: 'User ID', value: id },
    { name: 'Status', value: status },
  ]);
  if (validation.status === 'error') {
    return res.status(400).json({ status: '400', message: validation.message });
  }

  if (status !== '0' && status !== '1') {
    return res.status(400).json({ status: '400', message: 'Status must be 0 (inactive) or 1 (active)' });
  }

  // const roleIdBig = helper.safeBigInt(id);
  // if (!roleIdBig) {
  //   return res.status(400).json({ status: '400', message: 'Invalid User ID' });
  // }

  const userExists = await helper.selectRecordsWithCondition('users', { id: id });
  if (userExists.data.length === 0) {
    return res.status(404).json({ status: '404', message: 'User not found' });
  }

  if (userExists.data[0].is_system) {
    return res.status(403).json({ status: '403', message: 'Cannot change status of a system user' });
  }

  const result = await helper.dynamicUpdateWithId('users', { status }, id);
  if (result.status === 'error') {
    return res.status(500).json({ status: '500', message: result.message });
  }

  const statusText = status === '1' ? 'activated' : 'deactivated';
  res.status(200).json({ status: '200', message: `User ${statusText} successfully`, data: result.data });
});


// ─────────────────────────────────────────────
// @desc    Get the currently authenticated user
//          with their linked entity (employee / guardian / student)
// @route   GET /me
// @access  Private
// ─────────────────────────────────────────────
const EMPLOYEE_PROFILE_INCLUDE = {
  jobTitle:       { select: { id: true, label: true, code: true } },
  department:     { select: { id: true, label: true, code: true } },
  employmentType: { select: { id: true, label: true, code: true } },
  nationality:    { select: { id: true, label: true, code: true } },
  religion:       { select: { id: true, label: true, code: true } },
  emergencyContacts: {
    orderBy: [{ isPrimary: 'desc' }, { firstName: 'asc' }],
  },
  teacher: {
    select: {
      id: true,
      staffNumber: true,
      teachersubject: {
        select: {
          id: true,
          subject:    { select: { id: true, name: true, code: true } },
          gradelevel: { select: { id: true, name: true } },
        },
      },
      gradelevel: { select: { id: true, name: true } },
    },
  },
  statusHistory: {
    orderBy: { changedAt: 'desc' },
    take: 20,
  },
};

const getMe = asyncHandler(async (req, res) => {
  const { id } = req.user;

  // Only include employee for now — guardian/student relations require
  // a regenerated Prisma client after the schema migration.
  const user = await helper.prisma.users.findUnique({
    where: { id },
    include: {
      employee: { include: EMPLOYEE_PROFILE_INCLUDE },
    },
  });

  if (!user) return respond.notFound(res, 'User not found');

  const userType = user.employee ? 'employee' : 'admin';

  let employee = null;
  if (user.employee) {
    const e = user.employee;
    const remap = (obj) => obj ? { ...obj, value: obj.label } : null;
    employee = {
      ...e,
      jobTitle:       remap(e.jobTitle),
      department:     remap(e.department),
      employmentType: remap(e.employmentType),
      nationality:    remap(e.nationality),
      religion:       remap(e.religion),
    };
  }

  const { password: _, ...safe } = user;

  return respond.ok(res, 'OK', { ...safe, employee, userType });
});


// ─────────────────────────────────────────────
// @desc    Persist the current user's UI theme preference (dark | light)
// @route   PUT /user/theme
// @access  Private
// ─────────────────────────────────────────────
const updateUserTheme = asyncHandler(async (req, res) => {
  const { theme } = req.body;
  if (!['dark', 'light'].includes(theme)) {
    return res.status(400).json({ status: '400', message: 'Invalid theme' });
  }
  await helper.prisma.$executeRawUnsafe(`UPDATE users SET theme = ? WHERE id = ?`, theme, req.user.id);
  return respond.ok(res, 'Theme saved');
});


module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getAllUsers,
  getUserById,
  updateUser,
  changePassword,
  deactivateUser,
  activateUser,
  updateUserStatus,
  getMe,
  updateUserTheme,
};