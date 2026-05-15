import { AppUser } from '@/types/permissions';

// ─────────────────────────────────────────────────────────────────────────────
// Access token — lives ONLY in memory (never written to any storage).
//
// Why: localStorage / sessionStorage are readable by any JS on the page,
// making them vulnerable to XSS. An in-memory variable is invisible to
// injected scripts.
//
// Trade-off: the token is lost on page refresh — this is intentional and is
// recovered transparently by initAuth() via the httpOnly refresh token cookie
// that the browser sends automatically.
// ─────────────────────────────────────────────────────────────────────────────
let _accessToken: string | null = null;

// Listeners notified whenever the stored user is updated (e.g. after a token refresh)
type UserChangeListener = (user: AppUser) => void;
const _userChangeListeners = new Set<UserChangeListener>();

/**
 * Subscribe to user/permission updates.
 * Returns an unsubscribe function — call it in a useEffect cleanup.
 */
export function onUserChange(fn: UserChangeListener): () => void {
  _userChangeListeners.add(fn);
  return () => _userChangeListeners.delete(fn);
}

// ─────────────────────────────────────────────────────────────────────────────
// User — stored in sessionStorage (auto-cleared when the tab closes).
// We avoid localStorage so stale user data never persists across sessions.
// Set<string> doesn't survive JSON, so we serialize it as a plain array.
// ─────────────────────────────────────────────────────────────────────────────
const USER_KEY = 'current_user';

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
// JWT expiry check — no external library needed.
// JWTs are base64url: header.payload.signature — we only decode the payload.
// ─────────────────────────────────────────────────────────────────────────────
export function isTokenExpired(token: string): boolean {
  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return true;
    const json = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload: { exp?: number } = JSON.parse(json);
    if (!payload.exp) return false; // no expiry claim → treat as valid
    return payload.exp * 1000 < Date.now();
  } catch {
    return true; // malformed token → treat as expired
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Persist a session after a successful login or silent token refresh.
 * Token goes into memory only; user goes into sessionStorage.
 */
export function setSession(token: string, user: AppUser): void {
  _accessToken = token;
  sessionStorage.setItem(USER_KEY, serializeUser(user));
}

/** Wipe all auth state and send the user to the login page. */
export function logout(): void {
  _accessToken = null;
  sessionStorage.removeItem(USER_KEY);
  window.location.replace('/');
}

/**
 * Returns the in-memory access token.
 * Returns null (and triggers logout) if it is absent or expired.
 */
export function getToken(): string | null {
  if (!_accessToken) return null;
  if (isTokenExpired(_accessToken)) {
    logout();
    return null;
  }
  return _accessToken;
}

/**
 * Overwrite the in-memory token without touching the user.
 * Called by the silent refresh in api.ts after a successful token rotation.
 */
export function updateToken(token: string): void {
  _accessToken = token;
}

/**
 * Overwrite the stored user and notify all subscribers (e.g. App.tsx).
 * Called by the silent refresh when the server returns fresh user/permission data.
 */
export function updateUser(user: AppUser): void {
  sessionStorage.setItem(USER_KEY, serializeUser(user));
  _userChangeListeners.forEach(fn => fn(user));
}

/** Returns the stored AppUser, or null if absent / storage is corrupted. */
export function getCurrentUser(): AppUser | null {
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    if (!raw) return null;
    return deserializeUser(raw);
  } catch {
    // Corrupted storage — wipe everything and force re-login
    logout();
    return null;
  }
}

/** True only when a valid (non-expired) token AND a user object are present. */
export function isAuthenticated(): boolean {
  return !!getToken() && !!getCurrentUser();
}

// ─────────────────────────────────────────────────────────────────────────────
// initAuth — call ONCE at app startup before rendering (main.tsx / App.tsx).
//
// On page refresh the in-memory token is gone, but the httpOnly refresh token
// cookie is still present. We silently call /user/refresh-token to restore
// the session, so the user is never kicked out just because they refreshed.
//
// Returns the AppUser on success, or null if the session cannot be restored
// (refresh token missing / expired / revoked → show the login screen).
//
// Usage in main.tsx:
//   const user = await initAuth();
//   render(<App initialUser={user} />);
// ─────────────────────────────────────────────────────────────────────────────
export async function initAuth(): Promise<AppUser | null> {
  try {
    const { default: api }           = await import('./api');
    const { normalizeFromLogin }     = await import('./permissions');

    const res = await api.get<{ accessToken: string; data: any }>(
      '/user/refresh-token'
    );

    const { accessToken, data } = res.data;
    if (!accessToken || !data) return null;

    const appUser = normalizeFromLogin(data);
    setSession(accessToken, appUser);
    return appUser;

  } catch {
    // Refresh token absent, expired, or revoked — no session to restore.
    // Clear any stale user data but do NOT redirect (app hasn't rendered yet).
    sessionStorage.removeItem(USER_KEY);
    return null;
  }
}