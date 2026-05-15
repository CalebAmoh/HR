/**
 * PERMISSIONS
 *
 * String values must match `name` column in the backend permissions table exactly.
 * Usage:
 *   can(PERMISSIONS.VIEW_STUDENTS)
 *   canAny([PERMISSIONS.VIEW_FEES, PERMISSIONS.VIEW_FEE_STRUCTURE])
 */
export const PERMISSIONS = {
  // ── Users ──────────────────────────────────────────────────
  VIEW_USERS:                     'view_users',
  CREATE_USERS:                   'create_users',
  EDIT_USERS:                     'edit_users',
  CHANGE_USER_STATUS:             'change_user_status',
  CHANGE_USER_PASSWORD:           'change_user_password',

  // ── Roles ──────────────────────────────────────────────────
  VIEW_ROLES:                     'view_roles',
  MANAGE_ROLES:                   'manage_roles',
  ASSIGN_ROLES:                   'assign_roles',
  REVOKE_ROLES:                   'revoke_roles',

  // ── Permissions ────────────────────────────────────────────
  VIEW_PERMISSIONS:               'view_permissions',
  ASSIGN_PERMISSIONS:             'assign_permissions',
  REVOKE_PERMISSIONS:             'revoke_permissions',

  // ── Settings ───────────────────────────────────────────────
  VIEW_SETTINGS:                  'view_settings',
  EDIT_SETTINGS:                  'edit_settings',
  MANAGE_CODE_LISTS:              'manage_code_lists',
  MANAGE_ACADEMIC_SETUP:          'manage_academic_setup',

  // ── Reports ────────────────────────────────────────────────
  VIEW_REPORTS:                   'view_reports',
  GENERATE_REPORTS:               'generate_reports',
  EXPORT_REPORTS:                 'export_reports',

  // ── Students ───────────────────────────────────────────────
  VIEW_STUDENTS:                  'view_students',
  CREATE_STUDENTS:                'create_students',
  EDIT_STUDENTS:                  'edit_students',
  CHANGE_STUDENT_STATUS:          'change_student_status',
  PROMOTE_STUDENTS:               'promote_students',
  CHANGE_STUDENT_PASSWORD:        'change_student_password',
  MANAGE_STUDENT_DOCUMENTS:       'manage_student_documents',

  // ── HR & Employees ─────────────────────────────────────────
  VIEW_EMPLOYEES:                 'view_employees',
  CREATE_EMPLOYEES:               'create_employees',
  EDIT_EMPLOYEES:                 'edit_employees',
  CHANGE_EMPLOYEE_STATUS:         'change_employee_status',

  // ── Payroll ────────────────────────────────────────────────
  VIEW_PAYROLL:                   'view_payroll',
  MANAGE_PAYROLL_COMPONENTS:      'manage_payroll_components',
  MANAGE_PAYROLL_PROFILES:        'manage_payroll_profiles',
  PROCESS_PAYROLL:                'process_payroll',
  APPROVE_PAYROLL:                'approve_payroll',

  // ── Leave ──────────────────────────────────────────────────
  VIEW_LEAVE:                     'view_leave',
  MANAGE_LEAVE:                   'manage_leave',

  // ── Fees ───────────────────────────────────────────────────
  VIEW_FEE_STRUCTURE:             'view_fee_structure',
  MANAGE_FEE_STRUCTURE:           'manage_fee_structure',
  VIEW_PAYMENTS:                  'view_payments',
  RECORD_PAYMENTS:                'record_payments',
  MANAGE_DISCOUNTS:               'manage_discounts',
  GENERATE_INVOICES:              'generate_invoices',

  // ── Enrollment ─────────────────────────────────────────────
  VIEW_APPLICANTS:                'view_applicants',
  CREATE_APPLICANTS:              'create_applicants',
  EDIT_APPLICANTS:                'edit_applicants',
  CHANGE_APPLICANT_STATUS:        'change_applicant_status',
  VIEW_INTERVIEWS:                'view_interviews',
  INTERVIEWS_APPLICANTS:          'interviews_applicants',
  EDIT_INTERVIEWS:                'edit_interviews',
  DELETE_INTERVIEWS:              'delete_interviews',
  VIEW_ADMISSIONS:                'view_admissions',
  CONFIRM_ADMISSIONS:             'confirm_admissions',
  REVOKE_ADMISSIONS:              'revoke_admissions',

  // ── Classes & Sections ─────────────────────────────────────
  VIEW_CLASSES:                   'view_classes',
  CREATE_CLASSES:                 'create_classes',
  EDIT_CLASSES:                   'edit_classes',
  MANAGE_CLASSES:                 'manage_classes',
  MANAGE_SECTIONS:                'manage_sections',
  CREATE_SECTIONS:                'create_sections',
  EDIT_SECTIONS:                  'edit_sections',
  DELETE_SECTIONS:                'delete_sections',


  // ── Teachers ─────────────────────────────────────
  VIEW_TEACHERS:                  'view_teachers',
  DEACTIVATE_TEACHERS:            'de/activate_teachers',
  ASSIGN_SUBJECTS_TEACHERS:         'assign_subjects_teachers',

  // ── Subjects ───────────────────────────────────────────────
  VIEW_SUBJECTS:                  'view_subjects',
  MANAGE_SUBJECTS:                'manage_subjects',

  // ── Assessment / Exams ─────────────────────────────────────
  VIEW_EXAMS:                     'view_exams',
  RECORD_EXAMS:                   'record_exams',
  APPROVE_EXAMS:                  'approve_exams',

  // ── Schedule ───────────────────────────────────────────────
  VIEW_SCHEDULE:                  'view_schedule',
  MANAGE_SCHEDULE:                'manage_schedule',

  // ── Library ────────────────────────────────────────────────
  VIEW_LIBRARY:                   'view_library',
  MANAGE_LIBRARY_BOOKS:           'manage_library_books',
  MANAGE_LIBRARY_MEMBERS:         'manage_library_members',
  MANAGE_LIBRARY_ISSUES:          'manage_library_issues',

  // ── Attendance ─────────────────────────────────────────────
  VIEW_ATTENDANCE:                'view_attendance',
  MARK_ATTENDANCE:                'mark_attendance',

  // ── Transport ──────────────────────────────────────────────
  VIEW_TRANSPORT:                 'view_transport',
  MANAGE_TRANSPORT_VEHICLES:      'manage_transport_vehicles',
  MANAGE_TRANSPORT_ROUTES:        'manage_transport_routes',
  MANAGE_TRANSPORT_ASSIGNMENTS:   'manage_transport_assignments',

  // ── Notices ────────────────────────────────────────────────
  VIEW_NOTICES:                   'view_notices',
  CREATE_NOTICES:                 'create_notices',
  SEND_NOTICES:                   'send_notices',
  DELETE_NOTICES:                 'delete_notices',
  MANAGE_NOTICE_TEMPLATES:        'manage_notice_templates',
} as const;

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// ─────────────────────────────────────────────────────────────
// NAV PERMISSION MAP
// Maps each sidebar route/section to the permission(s) required.
// canAccessNav returns true if the user has ANY of the listed permissions.
// Empty array = always visible to authenticated users.
// ─────────────────────────────────────────────────────────────
export const NAV_PERMISSIONS: Record<string, string[]> = {
  // Always visible
  dashboard:              [],

  // ── Academics parent ──────────────────────────────────────────
  academics: [
    PERMISSIONS.VIEW_STUDENTS,
    PERMISSIONS.VIEW_EMPLOYEES,
    PERMISSIONS.VIEW_CLASSES,    PERMISSIONS.MANAGE_CLASSES,
    PERMISSIONS.VIEW_SUBJECTS,   PERMISSIONS.MANAGE_SUBJECTS,
    PERMISSIONS.VIEW_EXAMS,      PERMISSIONS.RECORD_EXAMS,
    PERMISSIONS.VIEW_SCHEDULE,   PERMISSIONS.MANAGE_SCHEDULE,
    PERMISSIONS.VIEW_LIBRARY,
  ],

  // Students
  students:               [PERMISSIONS.VIEW_STUDENTS],

  // Teachers
  teachers:               [PERMISSIONS.VIEW_TEACHERS, PERMISSIONS.DEACTIVATE_TEACHERS, PERMISSIONS.ASSIGN_SUBJECTS_TEACHERS],

  // Subject & Class
  subject:                [PERMISSIONS.VIEW_SUBJECTS,  PERMISSIONS.MANAGE_SUBJECTS],
  class:                  [PERMISSIONS.VIEW_CLASSES,PERMISSIONS.EDIT_CLASSES,PERMISSIONS.MANAGE_CLASSES,PERMISSIONS.CREATE_CLASSES],
  'sections':             [PERMISSIONS.CREATE_SECTIONS,   PERMISSIONS.EDIT_SECTIONS, PERMISSIONS.DELETE_SECTIONS, PERMISSIONS.MANAGE_SECTIONS],

  // Schedule, Library
  schedule:               [PERMISSIONS.VIEW_SCHEDULE,  PERMISSIONS.MANAGE_SCHEDULE],
  library:                [PERMISSIONS.VIEW_LIBRARY,   PERMISSIONS.MANAGE_LIBRARY_BOOKS, PERMISSIONS.MANAGE_LIBRARY_ISSUES],

  // ── Attendance ────────────────────────────────────────────────
  attendance:             [PERMISSIONS.VIEW_ATTENDANCE, PERMISSIONS.MARK_ATTENDANCE],
  'attendance-student':   [PERMISSIONS.VIEW_ATTENDANCE, PERMISSIONS.MARK_ATTENDANCE],
  'attendance-teacher':   [PERMISSIONS.VIEW_ATTENDANCE, PERMISSIONS.MARK_ATTENDANCE],

  // Notice, Transport
  notice:                 [PERMISSIONS.VIEW_NOTICES,   PERMISSIONS.CREATE_NOTICES],
  transport:              [PERMISSIONS.VIEW_TRANSPORT, PERMISSIONS.MANAGE_TRANSPORT_VEHICLES, PERMISSIONS.MANAGE_TRANSPORT_ROUTES],

  // ── Fees parent ───────────────────────────────────────────────
  fees:                   [PERMISSIONS.VIEW_FEE_STRUCTURE, PERMISSIONS.VIEW_PAYMENTS],
  'fees-structure':       [PERMISSIONS.VIEW_FEE_STRUCTURE, PERMISSIONS.MANAGE_FEE_STRUCTURE],
  'fees-payment':         [PERMISSIONS.VIEW_PAYMENTS,      PERMISSIONS.RECORD_PAYMENTS],

  // ── Enrollment parent ─────────────────────────────────────────
  enrollment:             [PERMISSIONS.VIEW_APPLICANTS, PERMISSIONS.VIEW_ADMISSIONS, PERMISSIONS.VIEW_INTERVIEWS],
  admission:              [PERMISSIONS.VIEW_APPLICANTS, PERMISSIONS.VIEW_ADMISSIONS, PERMISSIONS.VIEW_INTERVIEWS],
  'admission-applicants': [PERMISSIONS.VIEW_APPLICANTS, PERMISSIONS.CREATE_APPLICANTS],
  'admission-interviews': [PERMISSIONS.VIEW_INTERVIEWS, PERMISSIONS.INTERVIEWS_APPLICANTS],
  'admission-admissions': [PERMISSIONS.VIEW_ADMISSIONS, PERMISSIONS.CONFIRM_ADMISSIONS],

  // ── HR Management ─────────────────────────────────────────────
  hr:                     [PERMISSIONS.VIEW_EMPLOYEES, PERMISSIONS.VIEW_PAYROLL, PERMISSIONS.VIEW_LEAVE],
  'create-employee':      [PERMISSIONS.VIEW_EMPLOYEES, PERMISSIONS.CREATE_EMPLOYEES],
  'create-payroll':       [PERMISSIONS.VIEW_PAYROLL,   PERMISSIONS.MANAGE_PAYROLL_COMPONENTS, PERMISSIONS.PROCESS_PAYROLL],
  'create-leave':         [PERMISSIONS.VIEW_LEAVE,     PERMISSIONS.MANAGE_LEAVE],

  // ── Exams / Assessment ────────────────────────────────────────
  exams:                  [PERMISSIONS.VIEW_EXAMS, PERMISSIONS.RECORD_EXAMS, PERMISSIONS.APPROVE_EXAMS],
  'exam-record':          [PERMISSIONS.RECORD_EXAMS],
  'exam-approve':         [PERMISSIONS.APPROVE_EXAMS],
  'exam-broadsheet':      [PERMISSIONS.VIEW_EXAMS,  PERMISSIONS.GENERATE_REPORTS],
  'exam-report-card':     [PERMISSIONS.VIEW_EXAMS,  PERMISSIONS.GENERATE_REPORTS],

  // ── Settings ──────────────────────────────────────────────────
  settings:               [PERMISSIONS.VIEW_SETTINGS, PERMISSIONS.EDIT_SETTINGS, PERMISSIONS.VIEW_USERS, PERMISSIONS.VIEW_ROLES],
  'settings-users':       [PERMISSIONS.VIEW_USERS,    PERMISSIONS.CREATE_USERS],
  'settings-system':      [PERMISSIONS.EDIT_SETTINGS, PERMISSIONS.MANAGE_CODE_LISTS, PERMISSIONS.MANAGE_ACADEMIC_SETUP],
  'settings-super-admin': [PERMISSIONS.ASSIGN_PERMISSIONS, PERMISSIONS.REVOKE_PERMISSIONS, PERMISSIONS.VIEW_PERMISSIONS],
};
