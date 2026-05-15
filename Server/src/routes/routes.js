const express = require("express");
const router = express.Router();
const { checkToken, handleRefreshToken } = require("../middleware/authMiddleware");
const { registerUser, loginUser, getAllUsers, getUserById, updateUser, changePassword, deactivateUser, activateUser,updateUserStatus,getMe } = require("../controllers/userController.js");
const { assignRoleToUser, revokeRoleFromUser, assignPermissionToUser, revokePermissionFromUser, getAllRoles, getAllPermissions, getUserAccess, addRole, deleteRole, updateRole, updateRoleStatus } = require('../controllers/rolePermissionController');
const roleGuard       = require('../middleware/roleGuard');
const permissionGuard = require('../middleware/permissionGuard');


/* controller */
const {
    getCodeListValues,
    getActiveValuesByCode,
    createCodeListValue,
    updateCodeListValue,
    deactivateCodeListValue,
    getAllCodeLists,
    getCodeListById,
    createCodeList,
    updateCodeList,
    activateCodeListValue
  } = require("../controllers/systemController.js")

// ─────────────────────────────────────────────
// Public routes (no auth required)
// ─────────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'School management API is running' });
});

router.post('/login', loginUser);
router.get('/user/refresh-token', handleRefreshToken);


// ─────────────────────────────────────────────
// All routes below require a valid token
// ─────────────────────────────────────────────
router.use(checkToken);


// ─────────────────────────────────────────────
// User management — static routes first
// ─────────────────────────────────────────────
router.post('/user/register', roleGuard('admin','super-admin'), permissionGuard('create_users'), registerUser);
router.get('/users',     getAllUsers);   // ← renamed from GET / to avoid conflict with health check

router.get   ('/system/code-lists/:code/values/all',                  getCodeListValues);
router.post  ('/system/code-lists/:code/values',                      createCodeListValue);
router.put   ('/system/code-lists/:valueId/:id',                        updateCodeListValue);
router.put   ('/system/code-lists/:id/values/:valueId/deactivate',    deactivateCodeListValue);
router.put   ('/system/code-lists/:id/values/:valueId/activate',      activateCodeListValue);
router.get   ('/system/code-lists',                                   getAllCodeLists);
router.get   ('/system/code-lists/:id',                               getCodeListById);
router.post  ('/system/code-lists',                                   createCodeList);
router.put   ('/system/code-lists/:id',                               updateCodeList);
router.get   ('/system/code-lists/:code/values',                     getActiveValuesByCode);   // reference — no guard

// ─────────────────────────────────────────────
// Role management
// ─────────────────────────────────────────────
router.get('/roles',           roleGuard('admin','super-admin'), getAllRoles);
router.post('/roles',          roleGuard('super-admin','admin'), addRole);
router.post('/roles/assign',   roleGuard('admin','super-admin'), assignRoleToUser);
router.delete('/roles/revoke', roleGuard('admin','super-admin'), revokeRoleFromUser);
router.put('/roles/:id',       roleGuard('super-admin','admin'), updateRole);
router.put('/roles/:id/status', roleGuard('super-admin','admin'), updateRoleStatus);
router.delete('/roles/:id',    roleGuard('super-admin'), deleteRole); 

// ─────────────────────────────────────────────
// Permission management
// ─────────────────────────────────────────────
router.get('/permissions',           roleGuard('admin','super-admin'), getAllPermissions);
router.post('/permissions/assign',   roleGuard('admin','super-admin'), assignPermissionToUser);
router.delete('/permissions/revoke', roleGuard('admin','super-admin'), revokePermissionFromUser);


// ─────────────────────────────────────────────
// Dynamic user routes — must come after all static routes
// ─────────────────────────────────────────────
router.get('/:id/access',          roleGuard('admin','super-admin'), getUserAccess);
router.get('/:id',                 getUserById);
router.put('/:id',                 updateUser);
router.put('/:id/change-password', changePassword);
router.put('/:id/deactivate',      deactivateUser);
router.put('/:id/activate',        activateUser);
router.put('/user/:id/status', roleGuard('super-admin','admin'), updateUserStatus);
router.get('/me',            checkToken, getMe);

// ─────────────────────────────────────────────
// Catch-all
// ─────────────────────────────────────────────
router.all('*', (req, res) => {
  res.status(404).json({ status: '404', message: 'Route not found' });
});

module.exports = router;