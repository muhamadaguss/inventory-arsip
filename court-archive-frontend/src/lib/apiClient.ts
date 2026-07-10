const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

async function handleResponse<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.message ?? `Request failed with status ${response.status}`);
  }
  return body as T;
}

export async function post<T>(
  path: string,
  body: unknown,
  token: string | null,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  return handleResponse<T>(response);
}

export async function patch<T>(
  path: string,
  body: unknown,
  token: string | null,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });

  return handleResponse<T>(response);
}

export async function login(
  username: string,
  password: string,
): Promise<{ token: string; role: 'admin' | 'petugas' }> {
  return post('/auth/login', { username, password }, null);
}
