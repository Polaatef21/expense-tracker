// One place for every HTTP call: adds the JWT, turns error responses into
// ApiError objects, and reports expired/invalid sessions to AuthContext.
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  // { amount: 'Amount must be ...', date: '...' } for showing next to form fields
  fieldErrors() {
    const errors = {};
    for (const { field, message } of this.details) {
      if (field && !errors[field]) errors[field] = message;
    }
    return errors;
  }
}

let getToken = () => null;
let onUnauthorized = () => {};

export function configureApi(options) {
  ({ getToken, onUnauthorized } = options);
}

function buildUrl(path, query) {
  const url = new URL(`${API_URL}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  }
  return url;
}

export async function request(path, { method = 'GET', body, query, signal, raw = false } = {}) {
  const token = getToken();
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check that the API is running and try again.');
  }

  if (!response.ok) {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      // non-JSON error body (e.g. a proxy error page)
    }
    const error = new ApiError(
      response.status,
      payload?.error?.code ?? 'HTTP_ERROR',
      payload?.error?.message ?? `Request failed (${response.status})`,
      payload?.error?.details ?? [],
    );
    // A 401 on a request that carried a token means the session is no longer valid.
    // (A 401 from the login form itself is just "wrong password".)
    if (response.status === 401 && token) onUnauthorized(error);
    throw error;
  }

  if (raw) return response;
  if (response.status === 204) return null;
  return response.json();
}
