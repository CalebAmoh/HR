const express = require("express");
const router = express.Router();
const { checkToken, handleRefreshToken } = require("../middleware/authMiddleware");
const { registerUser, loginUser, getAllUsers, getUserById, updateUser, changePassword, deactivateUser, activateUser,updateUserStatus,getMe } = require("../controllers/userController.js");
const { assignRoleToUser, revokeRoleFromUser, assignPermissionToUser, revokePermissionFromUser, getAllRoles, getAllPermissions, getUserAccess, addRole, deleteRole, updateRole, updateRoleStatus } = require('../controllers/rolePermissionController');
const roleGuard       = require('../middleware/roleGuard');
const permissionGuard = require('../middleware/permissionGuard');


/* controllers */
const { uploadDocument, downloadDocument } = require('../controllers/documentController');
const { upload } = require('../middleware/upload');

const {
  getAllEmployees,
  getActiveEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  approveEmployee,
  changeEmployeeStatus,
  initiateResignation,
  getAllPaygrades,
  getAllNotches,
} = require('../controllers/employeeController.js');

const {
  getAllSkills, addSkill, updateSkill, deleteSkill,
  getAllCerts, addCert, updateCert, deleteCert,
  getAllEducation, addEducation, updateEducation, deleteEducation,
  getAllLanguages, addLanguage, updateLanguage, deleteLanguage,
  getAllDependents, addDependent, updateDependent, deleteDependent,
  getAllEmergencyContacts, addEmergencyContact, updateEmergencyContact, deleteEmergencyContact,
} = require('../controllers/employeeRelationsController');

const {
  getAllCompanyStructures,
  getStructureTypes,
  getCompanyStructureById,
  createCompanyStructure,
  updateCompanyStructure,
  deleteCompanyStructure,
} = require('../controllers/companyStructureController.js');

const salary = require('../controllers/salaryController.js');
const { getPaygrades, createPaygrade, updatePaygrade, deletePaygrade } = salary;

const calc = require('../controllers/calculationController.js');

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
  res.json({ status: 'ok', message: 'HR management API is running' });
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
// Document upload / download
// ─────────────────────────────────────────────
router.post('/employees/documents/upload', upload.single('file'), uploadDocument);
router.get('/documents/:filename',         downloadDocument);

// ─────────────────────────────────────────────
// Employee routes  (static before /:id)
// ─────────────────────────────────────────────
router.get   ('/employees/active',         getActiveEmployees);
router.get   ('/employees/paygrades',      getAllPaygrades);
router.get   ('/employees/notches',        getAllNotches);
router.get   ('/employees',                getAllEmployees);
router.post  ('/employees',                createEmployee);
router.get   ('/employees/:id',            getEmployeeById);
router.put   ('/employees/:id',            updateEmployee);
router.put   ('/employees/:id/approve',    approveEmployee);
router.put   ('/employees/:id/status',     changeEmployeeStatus);
router.post  ('/employees/:id/resign',     initiateResignation);

// ─────────────────────────────────────────────
// Relational / HR tab routes
// ─────────────────────────────────────────────
router.get   ('/skills',                 getAllSkills);
router.post  ('/skills',                 addSkill);
router.put   ('/skills/:id',             updateSkill);
router.delete('/skills/:id',             deleteSkill);

router.get   ('/certifications',         getAllCerts);
router.post  ('/certifications',         addCert);
router.put   ('/certifications/:id',     updateCert);
router.delete('/certifications/:id',     deleteCert);

router.get   ('/education',              getAllEducation);
router.post  ('/education',              addEducation);
router.put   ('/education/:id',          updateEducation);
router.delete('/education/:id',          deleteEducation);

router.get   ('/languages',              getAllLanguages);
router.post  ('/languages',              addLanguage);
router.put   ('/languages/:id',          updateLanguage);
router.delete('/languages/:id',          deleteLanguage);

router.get   ('/dependents',             getAllDependents);
router.post  ('/dependents',             addDependent);
router.put   ('/dependents/:id',         updateDependent);
router.delete('/dependents/:id',         deleteDependent);

router.get   ('/emergency-contacts',     getAllEmergencyContacts);
router.post  ('/emergency-contacts',     addEmergencyContact);
router.put   ('/emergency-contacts/:id', updateEmergencyContact);
router.delete('/emergency-contacts/:id', deleteEmergencyContact);

// ─────────────────────────────────────────────
// Company structure routes
// ─────────────────────────────────────────────
router.get   ('/company/structures/types',  getStructureTypes);
router.get   ('/company/structures',        getAllCompanyStructures);
router.post  ('/company/structures',        createCompanyStructure);
router.get   ('/company/structures/:id',    getCompanyStructureById);
router.put   ('/company/structures/:id',    updateCompanyStructure);
router.delete('/company/structures/:id',    deleteCompanyStructure);

// ─────────────────────────────────────────────
// Dynamic user routes — must come after all static routes
// ─────────────────────────────────────────────
// Salary setup routes
router.get   ('/salary/refs',                         salary.getSalaryRefs);
router.get   ('/salary/paygrades',                    getPaygrades);
router.post  ('/salary/paygrades',                    createPaygrade);
router.put   ('/salary/paygrades/:id',                updatePaygrade);
router.delete('/salary/paygrades/:id',                deletePaygrade);
router.get   ('/salary/component-types',              salary.getSalaryComponentTypes);
router.post  ('/salary/component-types',              salary.createSalaryComponentType);
router.put   ('/salary/component-types/:id',          salary.updateSalaryComponentType);
router.delete('/salary/component-types/:id',          salary.deleteSalaryComponentType);
router.get   ('/salary/components',                   salary.getSalaryComponents);
router.post  ('/salary/components',                   salary.createSalaryComponent);
router.put   ('/salary/components/:id',               salary.updateSalaryComponent);
router.delete('/salary/components/:id',               salary.deleteSalaryComponent);
router.get   ('/salary/employee-components',          salary.getEmployeeSalaryComponents);
router.get   ('/salary/history/:employeeId',          salary.getEmployeeSalaryHistory);
router.post  ('/salary/employee-components',          salary.createEmployeeSalaryComponent);
router.put   ('/salary/employee-components/:id',      salary.updateEmployeeSalaryComponent);
router.delete('/salary/employee-components/:id',      salary.deleteEmployeeSalaryComponent);
router.get   ('/salary/notches',                      salary.getNotches);
router.post  ('/salary/notches',                      salary.createNotch);
router.put   ('/salary/notches/:id',                  salary.updateNotch);
router.delete('/salary/notches/:id',                  salary.deleteNotch);
router.get   ('/salary/payment-types',                salary.getPaymentTypes);
router.post  ('/salary/payment-types',                salary.createPaymentType);
router.put   ('/salary/payment-types/:id',            salary.updatePaymentType);
router.delete('/salary/payment-types/:id',            salary.deletePaymentType);
router.get   ('/salary/notch-movements',              salary.getNotchMovements);
router.post  ('/salary/notch-movements',              salary.createNotchMovement);

// ─────────────────────────────────────────────
// Payroll calculation routes
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// Payroll runs (processing)
// ─────────────────────────────────────────────
const run = require('../controllers/payrollRunController');
const { getAuditLogs, getAuditModules } = require('../controllers/auditController');
router.get   ('/payroll/runs',                    run.getPayrollRuns);
router.post  ('/payroll/runs',                    run.createPayrollRun);
router.put   ('/payroll/runs/:id',                run.updatePayrollRun);
router.delete('/payroll/runs/:id',                run.deletePayrollRun);
router.post  ('/payroll/runs/:id/generate',       run.generatePayroll);
router.post  ('/payroll/runs/:id/finalize',       run.finalizePayroll);
router.post  ('/payroll/runs/:id/submit',         run.submitPayroll);
router.post  ('/payroll/runs/:id/approve',        run.approvePayroll);
router.post  ('/payroll/runs/:id/reject',         run.rejectPayroll);
router.get   ('/payroll/runs/:id/audit',          run.getPayrollAudit);
router.get   ('/payroll/runs/:id/data',           run.getPayrollData);
router.put   ('/payroll/runs/:id/data/:itemId',   run.updatePayrollDataItem);

// ─────────────────────────────────────────────
// Audit logs
// ─────────────────────────────────────────────
router.get('/audit-logs',         getAuditLogs);
router.get('/audit-logs/modules', getAuditModules);

router.get   ('/payroll/columns',                             calc.getPayrollColumns);
router.post  ('/payroll/columns',                             calc.createPayrollColumn);
router.patch ('/payroll/columns/reorder',                     calc.reorderPayrollColumns);
router.put   ('/payroll/columns/:id',                         calc.updatePayrollColumn);
router.delete('/payroll/columns/:id',                         calc.deletePayrollColumn);
router.get   ('/payroll/pay-frequencies',                     calc.getPayFrequencies);
router.post  ('/payroll/pay-frequencies',                     calc.createPayFrequency);
router.put   ('/payroll/pay-frequencies/:id',                 calc.updatePayFrequency);
router.delete('/payroll/pay-frequencies/:id',                 calc.deletePayFrequency);
router.get   ('/payroll/employees',                           calc.getPayrollEmployees);
router.post  ('/payroll/employees',                           calc.createPayrollEmployee);
router.put   ('/payroll/employees/:id',                       calc.updatePayrollEmployee);
router.delete('/payroll/employees/:id',                       calc.deletePayrollEmployee);
router.get   ('/payroll/calc-groups',                         calc.getCalcGroups);
router.post  ('/payroll/calc-groups',                         calc.createCalcGroup);
router.put   ('/payroll/calc-groups/:id',                     calc.updateCalcGroup);
router.delete('/payroll/calc-groups/:id',                     calc.deleteCalcGroup);
router.get   ('/payroll/saved-calculations',                  calc.getSavedCalculations);
router.get   ('/payroll/saved-calculations/:id',              calc.getSavedCalculationById);
router.post  ('/payroll/saved-calculations',                  calc.createSavedCalculation);
router.put   ('/payroll/saved-calculations/:id',              calc.updateSavedCalculation);
router.delete('/payroll/saved-calculations/:id',              calc.deleteSavedCalculation);
router.get   ('/payroll/payslip-templates',                   calc.getPayslipTemplates);
router.post  ('/payroll/payslip-templates',                   calc.createPayslipTemplate);
router.put   ('/payroll/payslip-templates/:id',               calc.updatePayslipTemplate);
router.delete('/payroll/payslip-templates/:id',               calc.deletePayslipTemplate);
const payslip = require('../controllers/payslipController');
router.get   ('/payroll/my-payslips',                         payslip.getMyPayslips);
router.get   ('/payroll/runs/:id/employees/:empId/payslip.pdf', payslip.downloadPayslip);

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
