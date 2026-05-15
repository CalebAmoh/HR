/**
 * prisma/seed.js
 *
 * Seeds the database with:
 *  - Super-admin and admin roles
 *  - All permissions grouped by feature area
 *  - Every permission assigned to the super-admin role
 *  - Selected permissions assigned to the admin role
 *  - A default super-admin user
 *
 * Safe to re-run — uses upsert/skipDuplicates throughout.
 *
 * Run with:
 *   npx prisma db seed
 *
 * Make sure your package.json has:
 *   "prisma": { "seed": "node prisma/seed.js" }
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
  'super-admin',
  'admin',
];

// ─────────────────────────────────────────────────────────
// Role descriptions
// ─────────────────────────────────────────────────────────
const ROLE_DESCRIPTIONS = {
  'super-admin': 'Full system access with all permissions',
  'admin': 'Administrative access to manage users, roles, and permissions',
};

// ─────────────────────────────────────────────────────────
// Permissions grouped by feature area
// Naming convention: <action>_<resource>
// ─────────────────────────────────────────────────────────
const PERMISSIONS = {
  // ── User Management ───────────────────────────────────
  'User Management': [
    'create_users',
    'view_users',
    'edit_users',
    'deactivate_users',
    'activate_users',
    'change_user_password',
  ],

  // ── Role & Permission Management ──────────────────────
  'Role & Permission Management': [
    'view_roles',
    'assign_roles',
    'revoke_roles',
    'view_permissions',
    'assign_permissions',
    'revoke_permissions',
  ],

  // ── Reports ───────────────────────────────────────────
  'Reports': [
    'view_reports',
    'export_reports',
    'generate_reports',
  ],

  // ── Settings ──────────────────────────────────────────
  'Settings': [
    'view_settings',
    'edit_settings',
  ],
};

// Flatten to a single array for easy iteration
const ALL_PERMISSIONS = Object.values(PERMISSIONS).flat();

// ─────────────────────────────────────────────────────────
// Role → prefix map (mirrors registerUser.js)
// ─────────────────────────────────────────────────────────
const ROLE_PREFIX_MAP = {
  'super-admin': 'SAD',
  admin:         'ADM',
};

async function main() {
  console.log('🌱 Starting seed...\n');

  // ── 1. Upsert roles ──────────────────────────────────
  console.log('📋 Seeding roles...');
  const createdRoles = {};

  for (const roleName of ROLES) {
    const role = await prisma.roles.upsert({
      where:  { name_guard_name: { name: roleName, guard_name: GUARD } },
      update: { updated_at: NOW },
      create: { name: roleName, guard_name: GUARD, description: ROLE_DESCRIPTIONS[roleName], is_system: true, created_at: NOW, updated_at: NOW },
    });
    createdRoles[roleName] = role;
    console.log(`   ✔ Role: ${roleName} (id: ${role.id})`);
  }

  // ── 2. Upsert permissions ────────────────────────────
  console.log('\n🔑 Seeding permissions...');
  const createdPermissions = {};

  for (const [group, perms] of Object.entries(PERMISSIONS)) {
    console.log(`\n   [${group}]`);
    for (const permName of perms) {
      const perm = await prisma.permissions.upsert({
        where:  { name_guard_name: { name: permName, guard_name: GUARD } },
        update: { updated_at: NOW },
        create: { name: permName, guard_name: GUARD, created_at: NOW, updated_at: NOW },
      });
      createdPermissions[permName] = perm;
      console.log(`      ✔ ${permName} (id: ${perm.id})`);
    }
  }

  // ── 3. Assign ALL permissions to super-admin ─────────
  console.log('\n🛡️  Assigning all permissions to super-admin...');
  const superAdminRole = createdRoles['super-admin'];

  for (const permName of ALL_PERMISSIONS) {
    const perm = createdPermissions[permName];
    await prisma.role_has_permissions.upsert({
      where: {
        permission_id_role_id: {
          permission_id: perm.id,
          role_id:       superAdminRole.id,
        },
      },
      update: {},
      create: {
        permission_id: perm.id,
        role_id:       superAdminRole.id,
      },
    });
  }
  console.log(`   ✔ ${ALL_PERMISSIONS.length} permissions assigned to super-admin`);

  // ── 4. Assign User Management permissions to admin ───
  console.log('\n👤 Assigning User Management + Role permissions to admin...');
  const adminPermissions = [
    ...PERMISSIONS['User Management'],
    ...PERMISSIONS['Role & Permission Management'],
  ];
  const adminRole = createdRoles['admin'];

  for (const permName of adminPermissions) {
    const perm = createdPermissions[permName];
    await prisma.role_has_permissions.upsert({
      where: {
        permission_id_role_id: {
          permission_id: perm.id,
          role_id:       adminRole.id,
        },
      },
      update: {},
      create: {
        permission_id: perm.id,
        role_id:       adminRole.id,
      },
    });
  }
  console.log(`   ✔ ${adminPermissions.length} permissions assigned to admin`);

  // ── 5. Seed default super-admin user ─────────────────
  console.log('\n👑 Seeding default super-admin user...');

  const existing = await prisma.users.findFirst({
    where: { email: 'superadmin@system.com' },
  });

  let superAdminUser;

  if (existing) {
    console.log('   ⚠ Super-admin user already exists — skipping creation');
    superAdminUser = existing;
  } else {
    // Generate employee ID: SAD-<YEAR>-0001
    const year        = NOW.getFullYear();
    const prefix      = ROLE_PREFIX_MAP['super-admin'];
    const employeeId  = `${prefix}-${year}-0001`;

    const salt           = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('SuperAdmin@123', salt);

    superAdminUser = await prisma.users.create({
      data: {
        firstname:   'Super',
        lastname:    'Admin',
        email:       'superadmin@system.com',
        phone:       '0000000000',
        employee_id: employeeId,
        password:    hashedPassword,
        posted_by:   0,
        status:      '1',
      },
    });
    console.log(`   ✔ User created: superadmin@system.com (employee ID: ${employeeId})`);
  }

  // ── 6. Assign super-admin role to the user ───────────
  await prisma.model_has_roles.upsert({
    where: {
      role_id_model_id_model_type: {
        role_id:    superAdminRole.id,
        model_id:   BigInt(superAdminUser.id),
        model_type: 'users',
      },
    },
    update: {},
    create: {
      role_id:    superAdminRole.id,
      model_id:   BigInt(superAdminUser.id),
      model_type: 'users',
    },
  });
  console.log('   ✔ super-admin role assigned to user');

  console.log('\n✅ Seed complete!\n');
  console.log('━'.repeat(45));
  console.log(`  Roles created     : ${ROLES.length}`);
  console.log(`  Permissions seeded: ${ALL_PERMISSIONS.length}`);
  console.log(`  Super-admin login :`);
  console.log(`    Email    → superadmin@system.com`);
  console.log(`    Password → SuperAdmin@123`);
  console.log('━'.repeat(45));
  console.log('  ⚠  Change the default password after first login!\n');
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });