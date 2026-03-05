export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, payload: unknown, message?: string) {
    super(message ?? extractApiErrorMessage(payload) ?? `Request failed with status ${status}`);
    this.status = status;
    this.payload = payload;
  }
}

function extractApiErrorMessage(payload: unknown): string | null {
  if (typeof payload === 'string') {
    const text = payload.trim();
    if (!text) {
      return null;
    }

    try {
      const parsed = JSON.parse(text) as unknown;
      return extractApiErrorMessage(parsed) ?? text;
    } catch {
      return text;
    }
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const message = (payload as { message?: unknown }).message;
  if (typeof message === 'string') {
    return message;
  }

  if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
    return message.join(', ');
  }

  const error = (payload as { error?: unknown }).error;
  if (typeof error === 'string') {
    return error;
  }

  return null;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export function buildQuery(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') {
      continue;
    }

    search.set(key, String(value));
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const contentType = response.headers.get('content-type') ?? '';
  const hasJson = contentType.includes('application/json');
  const payload = hasJson ? await response.json() : await response.text();

  if (!response.ok) {
    throw new ApiError(response.status, payload);
  }

  return payload as T;
}

export async function apiFetchBlob(path: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    let payload: unknown = null;
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      payload = await response.json();
    } else {
      payload = await response.text();
    }
    throw new ApiError(response.status, payload);
  }

  return response.blob();
}

export function getApiBase() {
  return API_BASE;
}
