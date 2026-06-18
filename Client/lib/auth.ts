import { AppUser } from '@/types/permissions';

// ─────────────────────────────────────────────────────────────────────────────
// Auth persistence uses localStorage so sessions survive page reloads AND
// browser restarts. For an internal HR system on a corporate network this
// trade-off (XSS-readable vs. persistent sessions) is acceptable.
//
// logout() wipes both keys, so the session ends immediately on explicit logout.
// ─────────────────────────────────────────────────────────────────────────────
const TOKEN_KEY = 'hr_access_token';
const USER_KEY  = 'hr_current_user';

let _accessToken: string | null = null;

type UserChangeListener = (user: AppUser) => void;
const _userChangeListeners = new Set<UserChangeListener>();

export function onUserChange(fn: UserChangeListener): () => void {
  _userChangeListeners.add(fn);
  return () => _userChangeListeners.delete(fn);
}

// ─────────────────────────────────────────────────────────────────────────────
// User serialisation — Set<string> doesn't survive JSON round-trips.
// ─────────────────────────────────────────────────────────────────────────────
interface SerializedUser extends Omit<AppUser, 'resolvedPermissions'> {
  resolvedPermissions: string[];
}

function serializeUser(user: AppUser): string {
  const s: SerializedUser = {
    ...user,
    resolvedPermissions: Array.from(user.resolvedPermissions),
  };
  return JSON.stringify(s);
}

function deserializeUser(raw: string): AppUser {
  const parsed: SerializedUser = JSON.parse(raw);
  return {
    ...parsed,
    resolvedPermissions: new Set(parsed.resolvedPermissions),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// JWT expiry check
// ─────────────────────────────────────────────────────────────────────────────
export function isTokenExpired(token: string): boolean {
  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return true;
    const json = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload: { exp?: number } = JSON.parse(json);
    if (!payload.exp) return false;
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage helpers — safe wrappers so private-mode / quota errors don't crash
// ─────────────────────────────────────────────────────────────────────────────
function storageGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function storageSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}
function storageRemove(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/** Persist a session after login or silent token refresh. */
export function setSession(token: string, user: AppUser): void {
  _accessToken = token;
  storageSet(TOKEN_KEY, token);
  storageSet(USER_KEY, serializeUser(user));
}

/**
 * Clear all auth data and navigate to the login screen.
 * Also cleans up any legacy sessionStorage keys from older builds.
 */
export function logout(): void {
  _accessToken = null;
  storageRemove(TOKEN_KEY);
  storageRemove(USER_KEY);
  // Clean up legacy keys used before switching to localStorage
  try { sessionStorage.removeItem('access_token');  } catch { /* ignore */ }
  try { sessionStorage.removeItem('current_user');  } catch { /* ignore */ }
  window.location.replace('/');
}

/**
 * Returns a valid access token, or null.
 * Checks memory first, then localStorage (page-reload / new-tab case).
 * Never calls logout() — callers rely on the 401 interceptor for silent refresh.
 */
export function getToken(): string | null {
  if (_accessToken && !isTokenExpired(_accessToken)) return _accessToken;

  const stored = storageGet(TOKEN_KEY);
  if (stored && !isTokenExpired(stored)) {
    _accessToken = stored;
    return stored;
  }

  return null;
}

/** Update token after a silent refresh. */
export function updateToken(token: string): void {
  _accessToken = token;
  storageSet(TOKEN_KEY, token);
}

/** Update stored user and notify subscribers. */
export function updateUser(user: AppUser): void {
  storageSet(USER_KEY, serializeUser(user));
  _userChangeListeners.forEach(fn => fn(user));
}

/**
 * Returns the stored AppUser, or null.
 * Never calls logout() — corrupted storage is silently cleared instead.
 */
export function getCurrentUser(): AppUser | null {
  try {
    const raw = storageGet(USER_KEY);
    if (!raw) return null;
    return deserializeUser(raw);
  } catch {
    storageRemove(TOKEN_KEY);
    storageRemove(USER_KEY);
    return null;
  }
}

export function isAuthenticated(): boolean {
  return !!getToken() && !!getCurrentUser();
}

// ─────────────────────────────────────────────────────────────────────────────
// initAuth — call once before rendering (main.tsx).
//
// Priority:
//   1. Valid token in localStorage → restore instantly, zero network calls.
//   2. Token missing/expired → try the httpOnly refresh-token cookie.
//   3. Both fail → return null → show login screen.
// ─────────────────────────────────────────────────────────────────────────────
export async function initAuth(): Promise<AppUser | null> {
  // Fast path — valid token in storage (reload / new tab / browser restart)
  const storedToken = storageGet(TOKEN_KEY);
  const storedUser  = storageGet(USER_KEY);

  if (storedToken && !isTokenExpired(storedToken) && storedUser) {
    try {
      _accessToken = storedToken;
      return deserializeUser(storedUser);
    } catch {
      // Corrupted user data — fall through to refresh
      storageRemove(USER_KEY);
    }
  }

  // Slow path — token expired or user data missing, try refresh-token cookie
  try {
    const { default: api }       = await import('./api');
    const { normalizeFromLogin } = await import('./permissions');

    const res = await api.get<{ accessToken?: string; data?: any }>('/user/refresh-token');
    const { accessToken, data } = res.data ?? {};

    if (!accessToken) return null;

    if (data) {
      // Full user payload returned — update everything
      const appUser = normalizeFromLogin(data);
      setSession(accessToken, appUser);
      return appUser;
    }

    // Token-only refresh response (server's handleRefreshToken) — reuse stored user
    const existingUser = storageGet(USER_KEY);
    if (existingUser) {
      try {
        const appUser = deserializeUser(existingUser);
        _accessToken = accessToken;
        storageSet(TOKEN_KEY, accessToken);
        return appUser;
      } catch {
        storageRemove(USER_KEY);
      }
    }

    return null;

  } catch {
    storageRemove(TOKEN_KEY);
    storageRemove(USER_KEY);
    return null;
  }
}
