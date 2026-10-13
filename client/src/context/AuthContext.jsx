import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authApi } from '../api/auth.js';
import { configureApi } from '../api/client.js';
import { tokenExpiresAt } from '../utils/jwt.js';

// Session handling:
//  - the JWT is kept in localStorage so a refresh keeps you logged in
//  - on startup it is checked with GET /auth/me (rejects revoked/expired tokens)
//  - the browser logs out automatically when the token expires or the API returns 401
//  - logging out in one tab logs out the other tabs too
const TOKEN_KEY = 'expense-tracker.token';
const AuthContext = createContext(null);

function readStoredToken() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const expiresAt = token && tokenExpiresAt(token);
    return expiresAt && expiresAt > Date.now() ? token : null;
  } catch {
    return null;
  }
}

function storeToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable (private mode): the session lasts until the tab closes
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(readStoredToken);
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(token ? 'loading' : 'anonymous');
  const [notice, setNotice] = useState(null); // e.g. "Your session has expired"
  const tokenRef = useRef(token);

  const endSession = useCallback((message = null) => {
    tokenRef.current = null;
    storeToken(null);
    setToken(null);
    setUser(null);
    setStatus('anonymous');
    setNotice(message);
  }, []);

  const startSession = useCallback(({ token: newToken, user: newUser }) => {
    tokenRef.current = newToken;
    storeToken(newToken);
    setToken(newToken);
    setUser(newUser);
    setStatus('authenticated');
    setNotice(null);
  }, []);

  // Wire the API client to the current session
  useEffect(() => {
    configureApi({
      getToken: () => tokenRef.current,
      onUnauthorized: (error) => endSession(error.message || 'Your session has ended. Please log in again.'),
    });
  }, [endSession]);

  // Validate a stored token once on startup
  useEffect(() => {
    if (status !== 'loading') return undefined;
    const controller = new AbortController();
    authApi
      .me(controller.signal)
      .then(({ user: me }) => {
        setUser(me);
        setStatus('authenticated');
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        // Invalid token or unreachable API: show the login screen with the reason
        endSession(err.status === 401 ? 'Your session has expired. Please log in again.' : err.message);
      });
    return () => controller.abort();
  }, [status, endSession]);

  // Log out exactly when the token expires
  useEffect(() => {
    if (!token) return undefined;
    const expiresAt = tokenExpiresAt(token);
    if (!expiresAt) return undefined;
    const delay = Math.min(expiresAt - Date.now(), 2_147_483_647); // setTimeout max
    const timer = setTimeout(() => endSession('Your session has expired. Please log in again.'), delay);
    return () => clearTimeout(timer);
  }, [token, endSession]);

  // Keep tabs in sync: logout (or login) in another tab applies here too
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== TOKEN_KEY) return;
      if (!event.newValue) endSession();
      else if (event.newValue !== tokenRef.current) {
        tokenRef.current = event.newValue;
        setToken(event.newValue);
        setStatus('loading');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [endSession]);

  const value = useMemo(
    () => ({
      user,
      status,
      notice,
      clearNotice: () => setNotice(null),
      login: async (credentials) => startSession(await authApi.login(credentials)),
      register: async (details) => startSession(await authApi.register(details)),
      logout: () => endSession(null),
    }),
    [user, status, notice, startSession, endSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
