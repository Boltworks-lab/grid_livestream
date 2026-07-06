const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const TOKEN_KEY = 'grid.staffToken';

export const staffToken = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (token: string | null) => {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  },
};

/**
 * Small typed fetch for the staff API (a separate trust domain from the public
 * api-client). Folding /admin/* into the generated OpenAPI client is tracked in
 * docs/deferred.md.
 */
export async function adminApi<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: T | null; message?: string }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(staffToken.get() ? { authorization: `Bearer ${staffToken.get()}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (res.status === 401 && staffToken.get() && !path.startsWith('/admin/auth')) {
    staffToken.set(null);
    window.location.reload();
  }
  return { status: res.status, data: res.ok ? (data as T) : null, message: data?.message };
}
