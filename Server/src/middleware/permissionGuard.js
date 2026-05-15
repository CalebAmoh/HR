const permissionGuard = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ status: '401', message: 'Not authenticated' });
    }

    const hasPermission = requiredPermissions.every(permission =>
      req.user.permissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        status: '403',
        message: `Access denied. Required permission(s): ${requiredPermissions.join(', ')}`,
      });
    }

    next();
  };
};

module.exports = permissionGuard;