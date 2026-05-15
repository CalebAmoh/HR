import { LoginResponseData, ApiUser, AppUser, AppRole } from '../types/permissions';
import { NAV_PERMISSIONS } from './permissionKeys';

// ─────────────────────────────────────────────────────────────
// normalizeFromLogin
//
// Handles POST /login response shape:
//   roles: string[]          → names only, no permissions inside
//   permissions: string[]    → already resolved by the backend
//
// Since the backend already resolves permissions for us on login,
// we use that directly as resolvedPermissions. No merging needed.
// direct_permissions is not available at login — treated as empty.
// ─────────────────────────────────────────────────────────────
export function normalizeFromLogin(data: LoginResponseData): AppUser {
  const allRoles: AppRole[] = data.roles.map((name, i) => ({
    id: i,           // no id from login response, use index as placeholder
    name,
    isSystem: false, // unknown at login, update if needed after /user/:id fetch
    status: '1' as const,
    permissions: [], // not provided per-role at login
  }));

  const primaryRole = allRoles[0] ?? {
    id: 0, name: 'unknown', isSystem: false, status: '1' as const, permissions: []
  };

  return {
    id:                  data.id as unknown as number,  // CUID stored as string; typed number for compat
    name:                `${data.firstName} ${data.lastName}`,
    firstname:           data.firstName,
    lastname:            data.lastName,
    email:               data.email,
    employeeId:          data.employeeId || undefined,
    userType:            data.userType ?? (data.employeeId ? 'employee' : 'admin'),
    phone:               data.phone,
    status:              data.status,
    role:                primaryRole,
    allRoles,
    directPermissions:   [],                          // not in login response
    resolvedPermissions: new Set(data.permissions),   // use backend-resolved set directly
  };
}

// ─────────────────────────────────────────────────────────────
// normalizeFromUserEndpoint
//
// Handles GET /user/:id response shape:
//   roles: { id, name, permissions: string[] }[]
//   direct_permissions: string[]   (prefix "!" = revoke)
//
// We union all role permissions, then apply direct overrides.
// ─────────────────────────────────────────────────────────────
export function normalizeFromUserEndpoint(apiUser: ApiUser): AppUser {
  const allRoles: AppRole[] = apiUser.roles.map(r => ({
    id:          r.id,
    name:        r.name,
    isSystem:    false,
    status:      '1' as const,
    permissions: r.permissions,
  }));

  const primaryRole = allRoles[0] ?? {
    id: 0, name: 'unknown', isSystem: false, status: '1' as const, permissions: []
  };

  const rolePermissions = allRoles.flatMap(r => r.permissions);

  const resolvedPermissions = resolvePermissions(
    rolePermissions,
    apiUser.direct_permissions
  );

  return {
    id:                  apiUser.id,
    name:                apiUser.name,
    firstname:           apiUser.firstname,
    lastname:            apiUser.lastname,
    email:               apiUser.email,
    employeeId:          apiUser.employee_id || undefined,
    userType:            apiUser.employee_id ? 'employee' : 'admin',
    phone:               apiUser.phone,
    status:              apiUser.status,
    role:                primaryRole,
    allRoles,
    directPermissions:   apiUser.direct_permissions,
    resolvedPermissions,
  };
}

// ─────────────────────────────────────────────────────────────
// resolvePermissions
//
// Merges role permissions with direct overrides:
//   "permission_name"  → GRANT  (add)
//   "!permission_name" → REVOKE (remove)
// ─────────────────────────────────────────────────────────────
export function resolvePermissions(
  rolePermissions: string[],
  directPermissions: string[]
): Set<string> {
  const resolved = new Set<string>(rolePermissions);

  for (const perm of directPermissions) {
    if (perm.startsWith('!')) {
      resolved.delete(perm.slice(1));  // revoke
    } else {
      resolved.add(perm);              // grant
    }
  }

  return resolved;
}

// ─────────────────────────────────────────────────────────────
// canAccessNav — check a nav key against NAV_PERMISSIONS map
// ─────────────────────────────────────────────────────────────
export function canAccessNav(user: AppUser, navKey: string): boolean {
  const required = NAV_PERMISSIONS[navKey];
  if (!required || required.length === 0) return true;
  return required.some(k => user.resolvedPermissions.has(k));
}

export function canAccessAny(user: AppUser, keys: string[]): boolean {
  if (!keys || keys.length === 0) return true;
  return keys.some(k => user.resolvedPermissions.has(k));
}