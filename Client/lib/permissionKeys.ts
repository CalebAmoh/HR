/**
 * PERMISSIONS
 *
 * String values must match `name` column in the backend permissions table exactly.
 * Usage:
 *   can(PERMISSIONS.VIEW_STUDENTS)
 *   canAny([PERMISSIONS.VIEW_FEES, PERMISSIONS.VIEW_FEE_STRUCTURE])
 */
export const PERMISSIONS = {
  // ── Users & Access ─────────────────────────────────────────
  VIEW_USERS:                         'view_users',
  CREATE_USERS:                       'create_users',
  EDIT_USERS:                         'edit_users',
  DEACTIVATE_USERS:                   'deactivate_users',
  ACTIVATE_USERS:                     'activate_users',
  CHANGE_USER_PASSWORD:               'change_user_password',

  // ── Roles ──────────────────────────────────────────────────
  VIEW_ROLES:                         'view_roles',
  CREATE_ROLES:                       'create_roles',
  EDIT_ROLES:                         'edit_roles',
  DELETE_ROLES:                       'delete_roles',
  ASSIGN_ROLES:                       'assign_roles',
  REVOKE_ROLES:                       'revoke_roles',

  // ── Permissions ────────────────────────────────────────────
  VIEW_PERMISSIONS:                   'view_permissions',
  ASSIGN_PERMISSIONS:                 'assign_permissions',
  REVOKE_PERMISSIONS:                 'revoke_permissions',

  // ── Employees ──────────────────────────────────────────────
  VIEW_EMPLOYEES:                     'view_employees',
  CREATE_EMPLOYEES:                   'create_employees',
  EDIT_EMPLOYEES:                     'edit_employees',
  APPROVE_EMPLOYEES:                  'approve_employees',
  CHANGE_EMPLOYEE_STATUS:             'change_employee_status',

  // ── Employee Relations ─────────────────────────────────────
  MANAGE_SKILLS:                      'manage_skills',
  MANAGE_CERTIFICATIONS:              'manage_certifications',
  MANAGE_LANGUAGES:                   'manage_languages',
  MANAGE_DEPENDENTS:                  'manage_dependents',
  MANAGE_EMERGENCY_CONTACTS:          'manage_emergency_contacts',

  // ── Company ────────────────────────────────────────────────
  VIEW_COMPANY_STRUCTURE:             'view_company_structure',
  CREATE_COMPANY_STRUCTURE:           'create_company_structure',
  EDIT_COMPANY_STRUCTURE:             'edit_company_structure',
  DELETE_COMPANY_STRUCTURE:           'delete_company_structure',

  // ── Documents ──────────────────────────────────────────────
  VIEW_DOCUMENTS:                     'view_documents',
  CREATE_DOCUMENTS:                   'create_documents',
  EDIT_DOCUMENTS:                     'edit_documents',
  DELETE_DOCUMENTS:                   'delete_documents',
  DOWNLOAD_DOCUMENTS:                 'download_documents',

  // ── Leave ──────────────────────────────────────────────────
  VIEW_LEAVE:                         'view_leave',
  APPLY_LEAVE:                        'apply_leave',
  APPROVE_LEAVE:                      'approve_leave',
  CANCEL_LEAVE:                       'cancel_leave',
  VIEW_SUBORDINATE_LEAVE:             'view_subordinate_leave',

  // ── Leave Setup ────────────────────────────────────────────
  VIEW_LEAVE_SETUP:                   'view_leave_setup',
  MANAGE_LEAVE_TYPES:                 'manage_leave_types',
  MANAGE_LEAVE_PERIODS:               'manage_leave_periods',
  MANAGE_HOLIDAYS:                    'manage_holidays',
  MANAGE_WORK_WEEK:                   'manage_work_week',
  MANAGE_LEAVE_GROUPS:                'manage_leave_groups',
  MANAGE_LEAVE_RULES:                 'manage_leave_rules',

  // ── Salary ─────────────────────────────────────────────────
  VIEW_SALARY_SETUP:                  'view_salary_setup',
  MANAGE_SALARY_COMPONENT_TYPES:      'manage_salary_component_types',
  MANAGE_SALARY_COMPONENTS:           'manage_salary_components',
  MANAGE_EMPLOYEE_SALARY_COMPONENTS:  'manage_employee_salary_components',
  MANAGE_NOTCH_SETUP:                 'manage_notch_setup',
  MANAGE_PAYMENT_TYPES:               'manage_payment_types',
  MANAGE_NOTCH_MOVEMENTS:             'manage_notch_movements',

  // ── Payroll ────────────────────────────────────────────────
  VIEW_PAYROLL:                       'view_payroll',
  MANAGE_PAYROLL_EMPLOYEES:           'manage_payroll_employees',
  PROCESS_PAYROLL:                    'process_payroll',
  APPROVE_PAYROLL:                    'approve_payroll',
  VIEW_PAYROLL_REPORTS:               'view_payroll_reports',
  EXPORT_PAYROLL_REPORTS:             'export_payroll_reports',
  MANAGE_PAYROLL_COLUMNS:             'manage_payroll_columns',
  MANAGE_CALCULATION_GROUPS:          'manage_calculation_groups',

  // ── Reports ────────────────────────────────────────────────
  VIEW_REPORTS:                       'view_reports',
  GENERATE_REPORTS:                   'generate_reports',
  EXPORT_REPORTS:                     'export_reports',

  // ── System ─────────────────────────────────────────────────
  VIEW_SYSTEM:                        'view_system',
  MANAGE_APP_SETUP:                   'manage_app_setup',
  MANAGE_CODE_LISTS:                  'manage_code_lists',
  CREATE_CODE_LISTS:                  'create_code_lists',
  EDIT_CODE_LISTS:                    'edit_code_lists',

  // ── Settings ───────────────────────────────────────────────
  VIEW_SETTINGS:                      'view_settings',
  EDIT_SETTINGS:                      'edit_settings',
  MANAGE_LEAVE_SETTINGS:              'manage_leave_settings',
  MANAGE_NOTIFICATION_SETTINGS:       'manage_notification_settings',

  // ── Audit ──────────────────────────────────────────────────
  VIEW_AUDIT_LOGS:                    'view_audit_logs',
} as const;

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// ─────────────────────────────────────────────────────────────
// NAV PERMISSION MAP
// Maps each sidebar route/section to the permission(s) required.
// canAccessNav returns true if the user has ANY of the listed permissions.
// Empty array = always visible to authenticated users.
// ─────────────────────────────────────────────────────────────
export const NAV_PERMISSIONS: Record<string, string[]> = {
  // ── Always visible ────────────────────────────────────────────
  Dashboard:          [],
  Modules:            [],
  PersonalInfo:       [],
  Help:               [],

  // ── Main Menu ─────────────────────────────────────────────────
  Admin:              ['manage_app_setup', 'edit_settings', 'view_employees'],
  JobTitleSetups:     ['manage_app_setup', 'edit_settings'],
  QualificationSetups:['manage_app_setup', 'edit_settings'],
  LeavingSettings:    ['manage_app_setup', 'edit_settings'],
  AdminReports:       ['generate_reports', 'view_employees'],
  CentralApproval:    ['approve_leave', 'approve_payroll', 'view_subordinate_leave'],
  UserReports:        ['view_reports'],

  // ── Management ────────────────────────────────────────────────
  Employees:          ['view_employees'],
  Organogram:         ['view_company_structure', 'view_employees'],
  Company:            ['view_company_structure', 'view_employees'],
  Documents:          ['view_documents', 'download_documents'],

  // Leave
  Leave:              ['view_leave', 'apply_leave', 'approve_leave', 'view_leave_setup', 'manage_leave_types'],
  LeaveSetup:         ['view_leave_setup', 'manage_leave_types', 'manage_leave_periods', 'manage_holidays'],
  LeaveCalendar:      ['view_leave', 'apply_leave'],
  LeaveManagement:    ['view_leave', 'apply_leave'],

  // Payroll
  Payroll:            ['view_payroll', 'process_payroll', 'approve_payroll', 'manage_payroll_employees'],
  Salary:             ['view_salary_setup', 'manage_salary_component_types', 'manage_salary_components', 'manage_notch_setup'],

  // Medical
  Medical:            [],
  PersonalMedical:    [],
  AdminMedical:       ['view_employees'],

  // Users & System
  Users:              ['view_users', 'view_roles'],
  System:             ['view_system', 'manage_app_setup', 'manage_code_lists'],
  Settings:           ['view_settings', 'edit_settings', 'manage_leave_settings'],
  AuditLogs:          ['view_audit_logs'],
};
