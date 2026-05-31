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
  rejectEmployee,
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

const med   = require('../controllers/medicalController');
const leave = require('../controllers/leaveController');

// ─────────────────────────────────────────────
// Public routes (no auth required)
// ─────────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'HR management API is running' });
});

router.post('/login', loginUser);
router.get('/user/refresh-token', handleRefreshToken);

// Document view — public because filenames are unguessable SHA-256 hashes
router.get('/documents/:filename', downloadDocument);

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
router.put   ('/employees/:id/reject',     rejectEmployee);
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
router.post  ('/payroll/runs/:id/retry-gl',       run.retryGLPosting);
router.post  ('/payroll/runs/:id/submit',         run.submitPayroll);
router.post  ('/payroll/runs/:id/approve',        run.approvePayroll);
router.post  ('/payroll/runs/:id/reject',         run.rejectPayroll);
router.get   ('/payroll/runs/:id/audit',          run.getPayrollAudit);
router.get   ('/payroll/runs/:id/data',           run.getPayrollData);
router.get   ('/payroll/runs/:id/debug',          run.debugPayrollRun);
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

// ─────────────────────────────────────────────
// Medical routes
// ─────────────────────────────────────────────
router.get   ('/medical/staff',                             med.getStaffMedical);
router.post  ('/medical/staff',                             med.createStaffMedical);
router.put   ('/medical/staff/:id',                         med.updateStaffMedical);
router.delete('/medical/staff/:id',                         med.deleteStaffMedical);
router.post  ('/medical/staff/:id/submit',                  med.submitStaffMedical);
router.post  ('/medical/staff/:id/approve',                 med.approveStaffMedical);
router.post  ('/medical/staff/:id/reject',                  med.rejectStaffMedical);
router.post  ('/medical/staff/:id/finalize',                med.finalizeStaffMedical);
router.post  ('/medical/staff/:id/retry-gl',               med.retryStaffMedicalGL);

router.get   ('/medical/dependents-requests',               med.getDependentMedical);
router.post  ('/medical/dependents-requests',               med.createDependentMedical);
router.put   ('/medical/dependents-requests/:id',           med.updateDependentMedical);
router.delete('/medical/dependents-requests/:id',           med.deleteDependentMedical);
router.post  ('/medical/dependents-requests/:id/submit',    med.submitDependentMedical);
router.post  ('/medical/dependents-requests/:id/approve',   med.approveDependentMedical);
router.post  ('/medical/dependents-requests/:id/reject',    med.rejectDependentMedical);
router.post  ('/medical/dependents-requests/:id/finalize',  med.finalizeDependentMedical);
router.post  ('/medical/dependents-requests/:id/retry-gl', med.retryDependentMedicalGL);

router.get   ('/medical/limits',                   med.getMedicalLimits);
router.post  ('/medical/limits',                   med.createMedicalLimit);
router.put   ('/medical/limits/:id',               med.updateMedicalLimit);
router.delete('/medical/limits/:id',               med.deleteMedicalLimit);

router.get   ('/medical/enquiry/:id',               med.getMedicalEnquiryByEmployee);
router.get   ('/medical/enquiry',                  med.getMedicalEnquiry);
router.get   ('/medical/my-enquiry',               med.getMyMedicalEnquiry);

router.get   ('/medical/settings',                 med.getMedicalSettings);
router.put   ('/medical/settings',                 med.updateMedicalSettings);
router.get   ('/medical/gl-settings',              med.getMedicalGLSettings);
router.put   ('/medical/gl-settings',              med.updateMedicalGLSettings);

router.get   ('/medical/hospitals',                med.getHospitals);
router.post  ('/medical/hospitals',                med.createHospital);
router.put   ('/medical/hospitals/:id',            med.updateHospital);
router.delete('/medical/hospitals/:id',            med.deleteHospital);

router.get   ('/medical/claims',                   med.getHospitalClaims);
router.post  ('/medical/claims',                   med.createHospitalClaim);
router.put   ('/medical/claims/:id',               med.updateHospitalClaim);
router.delete('/medical/claims/:id',               med.deleteHospitalClaim);
router.post  ('/medical/claims/:id/submit',        med.submitHospitalClaim);
router.post  ('/medical/claims/:id/approve',       med.approveHospitalClaim);
router.post  ('/medical/claims/:id/retry-gl',     med.retryHospitalClaimGL);
router.post  ('/medical/claims/:id/reject',        med.rejectHospitalClaim);

// ─────────────────────────────────────────────
// Leave Setup
// ─────────────────────────────────────────────
router.get   ('/leave/types',                        leave.getLeaveTypes);
router.post  ('/leave/types',                        permissionGuard('manage_leave_types'),   leave.createLeaveType);
router.put   ('/leave/types/:id',                    permissionGuard('manage_leave_types'),   leave.updateLeaveType);
router.delete('/leave/types/:id',                    permissionGuard('manage_leave_types'),   leave.deleteLeaveType);

router.get   ('/leave/periods',                      leave.getLeavePeriods);
router.post  ('/leave/periods',                      permissionGuard('manage_leave_periods'), leave.createLeavePeriod);
router.put   ('/leave/periods/:id',                  permissionGuard('manage_leave_periods'), leave.updateLeavePeriod);
router.delete('/leave/periods/:id',                  permissionGuard('manage_leave_periods'), leave.deleteLeavePeriod);
router.post  ('/leave/periods/:id/activate',                  permissionGuard('manage_leave_periods'), leave.activateLeavePeriod);
router.post  ('/leave/periods/:id/recalculate-carryforward',  permissionGuard('manage_leave_periods'), leave.recalculateCarryForward);

router.get   ('/leave/holidays',                     leave.getHolidays);
router.post  ('/leave/holidays',                     permissionGuard('manage_holidays'),      leave.createHoliday);
router.put   ('/leave/holidays/:id',                 permissionGuard('manage_holidays'),      leave.updateHoliday);
router.delete('/leave/holidays/:id',                 permissionGuard('manage_holidays'),      leave.deleteHoliday);

router.get   ('/leave/workweek',                     leave.getWorkWeek);
router.put   ('/leave/workweek',                     permissionGuard('manage_work_week'),     leave.updateWorkWeek);

router.get   ('/leave/groups',                       leave.getLeaveGroups);
router.post  ('/leave/groups',                       permissionGuard('manage_leave_groups'),  leave.createLeaveGroup);
router.put   ('/leave/groups/:id',                   permissionGuard('manage_leave_groups'),  leave.updateLeaveGroup);
router.delete('/leave/groups/:id',                   permissionGuard('manage_leave_groups'),  leave.deleteLeaveGroup);
router.get   ('/leave/groups/:id/employees',         leave.getLeaveGroupEmployees);
router.post  ('/leave/groups/:id/employees',         permissionGuard('manage_leave_groups'),  leave.addLeaveGroupEmployee);
router.delete('/leave/groups/:id/employees/:eid',    permissionGuard('manage_leave_groups'),  leave.removeLeaveGroupEmployee);
router.get   ('/leave/groups/:id/paygrades',         leave.getLeaveGroupPaygrades);
router.post  ('/leave/groups/:id/paygrades',         permissionGuard('manage_leave_groups'),  leave.addLeaveGroupPaygrade);
router.delete('/leave/groups/:id/paygrades/:pgId',   permissionGuard('manage_leave_groups'),  leave.removeLeaveGroupPaygrade);

router.get   ('/leave/allowance-settings',            leave.getLeaveAllowanceSettings);
router.put   ('/leave/allowance-settings',            permissionGuard('manage_leave_settings'), leave.updateLeaveAllowanceSettings);

router.get   ('/leave/approval-settings',             leave.getApprovalFlowSettings);
router.put   ('/leave/approval-settings',             permissionGuard('manage_leave_settings'), leave.updateApprovalFlowSettings);

router.get   ('/leave/threshold-settings',            leave.getThresholdSettings);
router.put   ('/leave/threshold-settings',            permissionGuard('manage_leave_settings'), leave.updateThresholdSettings);

router.get   ('/leave/calendar-settings',             leave.getCalendarSettings);
router.put   ('/leave/calendar-settings',             permissionGuard('manage_leave_settings'), leave.updateCalendarSettings);

// Static before parameterised :id — must come before /leave/leaves/:id block
router.get   ('/leave/central-approval',              leave.getLeaveCentralApproval);
router.get   ('/leave/calendar',                      leave.getCalendarLeaves);

router.get   ('/leave/rules',                        leave.getLeaveRules);
router.post  ('/leave/rules',                        permissionGuard('manage_leave_rules'),   leave.createLeaveRule);
router.put   ('/leave/rules/:id',                    permissionGuard('manage_leave_rules'),   leave.updateLeaveRule);
router.delete('/leave/rules/:id',                    permissionGuard('manage_leave_rules'),   leave.deleteLeaveRule);

// ─────────────────────────────────────────────
// Leave Management — static sub-paths BEFORE :id
// ─────────────────────────────────────────────
router.get   ('/leave/subordinates',                 permissionGuard('view_subordinate_leave'), leave.getSubordinateEmployees);
router.get   ('/leave/leaves/subordinates',          permissionGuard('view_subordinate_leave'), leave.getSubordinateLeaves);
router.get   ('/leave/leaves/all',                   permissionGuard('approve_leave'),           leave.getAllEmployeeLeaves);
router.get   ('/leave/balance/:employeeId',          leave.getLeaveBalance);

router.get   ('/leave/leaves',                       leave.getLeaves);
router.post  ('/leave/leaves',                       permissionGuard('apply_leave'),             leave.applyLeave);
router.put   ('/leave/leaves/:id',                   leave.updateLeave);
router.delete('/leave/leaves/:id',                   leave.deleteLeave);
router.post  ('/leave/leaves/:id/submit',            permissionGuard('apply_leave'),             leave.submitLeave);
router.post  ('/leave/leaves/:id/approve',           permissionGuard('approve_leave'),           leave.approveLeave);
router.post  ('/leave/leaves/:id/reject',            permissionGuard('approve_leave'),           leave.rejectLeave);
router.post  ('/leave/leaves/:id/cancel',            permissionGuard('cancel_leave'),            leave.cancelLeave);
router.post  ('/leave/leaves/:id/finalize',          permissionGuard('approve_leave'),           leave.finalizeLeave);
router.post  ('/leave/leaves/:id/approve-allowance', permissionGuard('approve_leave'),           leave.approveAllowanceLeave);
router.post  ('/leave/leaves/:id/retry-gl',          permissionGuard('approve_leave'),           leave.retryLeaveGL);

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
