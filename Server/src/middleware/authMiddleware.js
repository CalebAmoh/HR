require('dotenv').config();
const apiKey = process.env.API_KEY;
const jwt    = require('jsonwebtoken');
const helper = require('../helpers/dbQueryHelper');
const asyncHandler = require('./asyncHandler');


// ─────────────────────────────────────────────
// @desc    Check API Key header
// ─────────────────────────────────────────────
function checkApiKey(req, res, next) {
  console.log('Checking API Key for path:', req.path);
  if (req.path.startsWith('/v1/api')) {
    const providedKey = req.headers['x-api-key'];
    if (!providedKey || providedKey !== apiKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  next();
}


// ─────────────────────────────────────────────
// @desc    Verify access token and attach
//          user + roles + permissions to req
// ─────────────────────────────────────────────
const checkToken = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ status: '401', message: 'Not authorized, no token' });
  }

  // Verify token — throws if expired or tampered
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // Fetch user — exclude password
  const userResult = await helper.selectRecordsWithCondition(
    'users',
    { id: decoded.id },
    { select: { id: true, username: true, email: true, status: true } }
  );

  if (userResult.status === 'error' || userResult.data.length === 0) {
    return res.status(401).json({ status: '401', message: 'User no longer exists' });
  }

  const user = userResult.data[0];

  // Reject deactivated users even if their token is still valid
  if (user.status !== '1') {
    return res.status(403).json({ status: '403', message: 'Account is deactivated. Contact administrator.' });
  }

  // Get user roles
  const rolesResult = await helper.selectRecordsWithQuery(`
    SELECT r.id, r.name
    FROM roles r
    INNER JOIN model_has_roles mhr ON mhr.role_id = r.id
    WHERE mhr.model_id = ? AND mhr.model_type = 'users'
  `, [user.id]);

  const roles = rolesResult.data ?? [];

  // Get permissions inherited from roles
  let permissionsFromRoles = [];
  if (roles.length > 0) {
    const placeholders = roles.map(() => '?').join(',');
    const rolePermsResult = await helper.selectRecordsWithQuery(`
      SELECT DISTINCT p.name
      FROM permissions p
      INNER JOIN role_has_permissions rhp ON rhp.permission_id = p.id
      WHERE rhp.role_id IN (${placeholders})
    `, roles.map(r => r.id));

    permissionsFromRoles = rolePermsResult.data ?? [];
  }

  // Get direct permissions assigned to user
  const directPermsResult = await helper.selectRecordsWithQuery(`
    SELECT DISTINCT p.name
    FROM permissions p
    INNER JOIN model_has_permissions mhp ON mhp.permission_id = p.id
    WHERE mhp.model_id = ? AND mhp.model_type = 'users'
  `, [user.id]);

  const directPermissions = directPermsResult.data ?? [];

  // Merge and deduplicate
  const allPermissions = [
    ...new Set([
      ...permissionsFromRoles.map(p => p.name),
      ...directPermissions.map(p => p.name),
    ]),
  ];

  // Attach to req.user for use in guards
  req.user = {
    ...user,
    roles:       roles.map(r => r.name),
    permissions: allPermissions,
  };

  next();
});


// ─────────────────────────────────────────────
// @desc    Issue a new access token using a
//          valid, non-revoked refresh token
// @route   GET /user/refresh-token
// @access  Public
// ─────────────────────────────────────────────
const handleRefreshToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  // 1. Cookie must be present
  if (!refreshToken) {
    return res.status(401).json({ status: '401', message: 'No refresh token provided' });
  }

  // 2. Look up the token in the refresh_tokens table
  const tokenResult = await helper.selectRecordsWithCondition('refresh_tokens', {
    token: refreshToken,
  });

  if (tokenResult.status === 'error' || tokenResult.data.length === 0) {
    return res.status(403).json({ status: '403', message: 'Invalid refresh token' });
  }

  const storedToken = tokenResult.data[0];

  // 3. Check if token has been revoked
  if (storedToken.revoked) {
    // Token reuse detected — revoke ALL tokens for this user as a security measure
    await helper.prisma.refresh_tokens.updateMany({
      where: { user_id: storedToken.user_id },
      data:  { revoked: true },
    });
    return res.status(403).json({ status: '403', message: 'Refresh token has been revoked' });
  }

  // 4. Check if token has expired in the DB
  if (new Date() > new Date(storedToken.expires_at)) {
    await helper.dynamicUpdateWithId('refresh_tokens', { revoked: true }, storedToken.id);
    return res.status(403).json({ status: '403', message: 'Refresh token has expired' });
  }

  // 5. Verify the JWT signature and expiry
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
  } catch (err) {
    // JWT is tampered or expired — revoke the DB record too
    await helper.dynamicUpdateWithId('refresh_tokens', { revoked: true }, storedToken.id);
    return res.status(403).json({ status: '403', message: 'Refresh token is invalid or expired' });
  }

  // 6. Fetch the user
  const userResult = await helper.selectRecordsWithCondition(
    'users',
    { id: decoded.id },
    { select: { id: true, username: true, email: true, status: true } }
  );

  if (userResult.status === 'error' || userResult.data.length === 0) {
    return res.status(403).json({ status: '403', message: 'User not found' });
  }

  const user = userResult.data[0];

  // 7. Reject deactivated users
  if (user.status !== '1') {
    return res.status(403).json({ status: '403', message: 'Account is deactivated. Contact administrator.' });
  }

  // 8. Rotate — revoke old token and issue a new refresh token
  await helper.dynamicUpdateWithId('refresh_tokens', { revoked: true }, storedToken.id);

  const newRefreshToken = jwt.sign(
    { id: user.id, email: user.email },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' }
  );

  const newExpiry = new Date();
  newExpiry.setDate(newExpiry.getDate() + 7);

  await helper.dynamicInsert('refresh_tokens', {
    user_id:    user.id,
    token:      newRefreshToken,
    expires_at: newExpiry,
    revoked:    false,
  });

  // 9. Issue new access token — same secret and payload as loginUser
  const newAccessToken = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  // 10. Set new refresh token cookie
  res.cookie('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   7 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    status:      '200',
    accessToken: newAccessToken,
  });
});


module.exports = { checkApiKey, checkToken, handleRefreshToken };