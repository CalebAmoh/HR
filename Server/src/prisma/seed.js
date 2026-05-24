/**
 * prisma/seed.js
 *
 * Seeds the database with:
 *  - Roles: super-admin, admin, hr-manager, employee
 *  - All permissions grouped by feature area (mirrors the UI chip groups)
 *  - Every permission assigned to super-admin
 *  - Admin: user + role + permission + system management
 *  - HR Manager: all HR, leave, salary, payroll, documents, reports
 *  - Employee: self-service read + apply leave
 *  - A default super-admin user (employee + users record)
 *
 * Safe to re-run — uses upsert / INSERT IGNORE throughout.
 *
 * Run with:
 *   npx prisma db seed
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const GUARD = 'api';
const NOW   = new Date();

// ─────────────────────────────────────────────────────────
// Roles
// ─────────────────────────────────────────────────────────
const ROLES = [
  { name: 'super-admin', description: 'Full system access — all permissions granted',            is_system: true  },
  { name: 'admin',       description: 'Manages users, roles, permissions and system setup',      is_system: true  },
  { name: 'hr-manager',  description: 'Full HR access: employees, leave, salary, payroll, docs', is_system: false },
  { name: 'employee',    description: 'Self-service: view own profile, apply for leave',          is_system: false },
];

// ─────────────────────────────────────────────────────────
// Permissions grouped by feature area
// Groups match UserCreationForm.tsx PERMISSION_GROUPS exactly
// ─────────────────────────────────────────────────────────
const PERMISSIONS = {

  // ── Users & Access ──────────────────────────────────────
  'Users & Access': [
    'view_users',
    'create_users',
    'edit_users',
    'deactivate_users',
    'activate_users',
    'change_user_password',
  ],

  // ── Roles ───────────────────────────────────────────────
  'Roles': [
    'view_roles',
    'create_roles',
    'edit_roles',
    'delete_roles',
    'assign_roles',
    'revoke_roles',
  ],

  // ── Permissions ─────────────────────────────────────────
  'Permissions': [
    'view_permissions',
    'assign_permissions',
    'revoke_permissions',
  ],

  // ── Employees ───────────────────────────────────────────
  'Employees': [
    'view_employees',
    'create_employees',
    'edit_employees',
    'approve_employees',
    'change_employee_status',
  ],

  // ── Employee Relations (tabs) ───────────────────────────
  'Employee Relations': [
    'manage_skills',
    'manage_certifications',
    'manage_languages',
    'manage_dependents',
    'manage_emergency_contacts',
  ],

  // ── Company ─────────────────────────────────────────────
  'Company': [
    'view_company_structure',
    'create_company_structure',
    'edit_company_structure',
    'delete_company_structure',
  ],

  // ── Documents ───────────────────────────────────────────
  'Documents': [
    'view_documents',
    'create_documents',
    'edit_documents',
    'delete_documents',
    'download_documents',
  ],

  // ── Leave Management ────────────────────────────────────
  'Leave': [
    'view_leave',
    'apply_leave',
    'approve_leave',
    'cancel_leave',
    'view_subordinate_leave',
  ],

  // ── Leave Setup ─────────────────────────────────────────
  'Leave Setup': [
    'view_leave_setup',
    'manage_leave_types',
    'manage_leave_periods',
    'manage_holidays',
    'manage_work_week',
    'manage_leave_groups',
    'manage_leave_rules',
  ],

  // ── Salary ──────────────────────────────────────────────
  'Salary': [
    'view_salary_setup',
    'manage_salary_component_types',
    'manage_salary_components',
    'manage_employee_salary_components',
    'manage_notch_setup',
    'manage_payment_types',
    'manage_notch_movements',
  ],

  // ── Payroll ─────────────────────────────────────────────
  'Payroll': [
    'view_payroll',
    'manage_payroll_employees',
    'process_payroll',
    'approve_payroll',
    'view_payroll_reports',
    'export_payroll_reports',
    'manage_payroll_columns',
    'manage_calculation_groups',
  ],

  // ── Reports ─────────────────────────────────────────────
  'Reports': [
    'view_reports',
    'generate_reports',
    'export_reports',
  ],

  // ── System ──────────────────────────────────────────────
  'System': [
    'view_system',
    'manage_app_setup',
    'manage_code_lists',
    'create_code_lists',
    'edit_code_lists',
  ],

  // ── Settings ────────────────────────────────────────────
  'Settings': [
    'view_settings',
    'edit_settings',
    'manage_leave_settings',
    'manage_notification_settings',
  ],

  // ── Audit ───────────────────────────────────────────────
  'Audit': [
    'view_audit_logs',
  ],
};

const ALL_PERMISSIONS = Object.values(PERMISSIONS).flat();

// ─────────────────────────────────────────────────────────
// Role → permission assignments
// ─────────────────────────────────────────────────────────
const ROLE_PERMISSIONS = {
  'super-admin': ALL_PERMISSIONS,

  'admin': [
    // User management
    ...PERMISSIONS['Users & Access'],
    // Role & permission management
    ...PERMISSIONS['Roles'],
    ...PERMISSIONS['Permissions'],
    // System & settings
    ...PERMISSIONS['System'],
    ...PERMISSIONS['Settings'],
    // Audit
    ...PERMISSIONS['Audit'],
    // Read access to HR
    'view_employees',
    'view_reports',
  ],

  'hr-manager': [
    // Full employee lifecycle
    ...PERMISSIONS['Employees'],
    ...PERMISSIONS['Employee Relations'],
    // Company structure
    ...PERMISSIONS['Company'],
    // Documents
    ...PERMISSIONS['Documents'],
    // Leave (all)
    ...PERMISSIONS['Leave'],
    ...PERMISSIONS['Leave Setup'],
    // Salary setup
    ...PERMISSIONS['Salary'],
    // Payroll
    ...PERMISSIONS['Payroll'],
    // Reports
    ...PERMISSIONS['Reports'],
    // Read-only user/role access
    'view_users',
    'view_roles',
  ],

  'employee': [
    'view_leave',
    'apply_leave',
    'cancel_leave',
    'view_documents',
    'download_documents',
    'view_reports',
  ],
};

// ─────────────────────────────────────────────────────────
// Ensure tables the login controller needs actually exist.
// ─────────────────────────────────────────────────────────
async function ensureTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`employee\` (
      \`id\`        BIGINT       NOT NULL AUTO_INCREMENT,
      \`firstName\` VARCHAR(100) NOT NULL DEFAULT '',
      \`lastName\`  VARCHAR(100) NOT NULL DEFAULT '',
      \`email\`     VARCHAR(100) NOT NULL DEFAULT '',
      \`phone\`     VARCHAR(20)  NULL,
      \`status\`    CHAR(1)      NOT NULL DEFAULT '1',
      PRIMARY KEY (\`id\`),
      UNIQUE INDEX \`employee_email_unique\` (\`email\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  const userColumns = [
    '`employeeId` BIGINT NULL',
    '`posted_by`  BIGINT NULL DEFAULT 0',
    '`status`     CHAR(1) NOT NULL DEFAULT \'1\'',
  ];
  for (const col of userColumns) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE \`users\` ADD COLUMN ${col}`);
    } catch {
      // Column already exists — safe to ignore
    }
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`refresh_tokens\` (
      \`id\`         BIGINT   NOT NULL AUTO_INCREMENT,
      \`user_id\`    BIGINT   NOT NULL,
      \`token\`      TEXT     NOT NULL,
      \`expires_at\` DATETIME NOT NULL,
      \`revoked\`    BOOLEAN  NOT NULL DEFAULT false,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
}

async function main() {
  console.log('🌱 Starting seed...\n');

  // ── 0. Ensure required tables ────────────────────────
  console.log('🛠  Ensuring schema is ready...');
  await ensureTables();
  console.log('   ✔ Tables verified\n');

  // ── 1. Upsert roles ──────────────────────────────────
  console.log('📋 Seeding roles...');
  const createdRoles = {};

  for (const { name, description, is_system } of ROLES) {
    const role = await prisma.roles.upsert({
      where:  { name_guard_name: { name, guard_name: GUARD } },
      update: { updated_at: NOW },
      create: { name, guard_name: GUARD, description, is_system, created_at: NOW, updated_at: NOW },
    });
    createdRoles[name] = role;
    console.log(`   ✔ ${name} (id: ${role.id})`);
  }

  // ── 2. Upsert permissions ────────────────────────────
  console.log('\n🔑 Seeding permissions...');
  const createdPermissions = {};
  let totalPerms = 0;

  for (const [group, perms] of Object.entries(PERMISSIONS)) {
    console.log(`\n   [${group}]`);
    for (const permName of perms) {
      const perm = await prisma.permissions.upsert({
        where:  { name_guard_name: { name: permName, guard_name: GUARD } },
        update: { updated_at: NOW },
        create: { name: permName, guard_name: GUARD, created_at: NOW, updated_at: NOW },
      });
      createdPermissions[permName] = perm;
      console.log(`      ✔ ${permName}`);
      totalPerms++;
    }
  }

  // ── 3. Assign permissions to each role ───────────────
  console.log('\n🛡️  Assigning permissions to roles...');

  for (const [roleName, permNames] of Object.entries(ROLE_PERMISSIONS)) {
    const role = createdRoles[roleName];
    const unique = [...new Set(permNames)];

    for (const permName of unique) {
      const perm = createdPermissions[permName];
      if (!perm) continue;
      await prisma.role_has_permissions.upsert({
        where:  { permission_id_role_id: { permission_id: perm.id, role_id: role.id } },
        update: {},
        create: { permission_id: perm.id, role_id: role.id },
      });
    }
    console.log(`   ✔ ${roleName} → ${unique.length} permissions`);
  }

  // ── 4. Seed super-admin employee record ──────────────
  console.log('\n👑 Seeding super-admin user...');

  const existingEmp = await prisma.$queryRawUnsafe(
    'SELECT id FROM `employee` WHERE email = ? LIMIT 1',
    'superadmin@usg.com'
  );

  let empId;
  if (existingEmp.length > 0) {
    empId = existingEmp[0].id;
    console.log('   ⚠ Employee record already exists — skipping');
  } else {
    await prisma.$executeRawUnsafe(
      'INSERT INTO `employee` (firstName, lastName, email, phone, status) VALUES (?, ?, ?, ?, ?)',
      'Super', 'Admin', 'superadmin@usg.com', '0000000000', '1'
    );
    const [newEmp] = await prisma.$queryRawUnsafe(
      'SELECT id FROM `employee` WHERE email = ? LIMIT 1',
      'superadmin@usg.com'
    );
    empId = newEmp.id;
    console.log(`   ✔ Employee created (id: ${empId})`);
  }

  // ── 5. Seed super-admin users record ─────────────────
  const salt           = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('pass1234', salt);

  const existingUser = await prisma.$queryRawUnsafe(
    'SELECT id FROM `users` WHERE username = ? LIMIT 1',
    'superadmin@usg.com'
  );

  let userId;
  if (existingUser.length > 0) {
    userId = existingUser[0].id;
    await prisma.$executeRawUnsafe(
      'UPDATE `users` SET password = ?, employeeId = ?, status = ? WHERE id = ?',
      hashedPassword, empId, '1', userId
    );
    console.log('   ✔ User already existed — password and employeeId reset');
  } else {
    await prisma.$executeRawUnsafe(
      'INSERT INTO `users` (username, password, employeeId, posted_by, status) VALUES (?, ?, ?, ?, ?)',
      'superadmin@usg.com', hashedPassword, empId, 0, '1'
    );
    const [newUser] = await prisma.$queryRawUnsafe(
      'SELECT id FROM `users` WHERE username = ? LIMIT 1',
      'superadmin@usg.com'
    );
    userId = newUser.id;
    console.log(`   ✔ User created (id: ${userId})`);
  }

  // ── 6. Assign super-admin role to user ───────────────
  const userIdStr = userId.toString();
  try {
    await prisma.model_has_roles.create({
      data: {
        role_id:    createdRoles['super-admin'].id,
        model_id:   userIdStr,
        model_type: 'users',
      },
    });
    console.log('   ✔ super-admin role assigned');
  } catch {
    console.log('   ⚠ Role already assigned — skipping');
  }

  // ── Summary ───────────────────────────────────────────
  console.log('\n✅ Seed complete!\n');
  console.log('━'.repeat(60));
  console.log('  Roles       :', ROLES.map(r => r.name).join(', '));
  console.log('  Permissions :', totalPerms, 'across', Object.keys(PERMISSIONS).length, 'groups');
  console.log('');
  console.log('  Permission groups:');
  for (const [group, perms] of Object.entries(PERMISSIONS)) {
    console.log(`    ${group.padEnd(25)} ${perms.length} permissions`);
  }
  console.log('');
  console.log('  Login with  :');
  console.log('    Username → superadmin@usg.com');
  console.log('    Password → pass1234');
  console.log('━'.repeat(60));
  console.log('  ⚠  Change the default password after first login!\n');
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
