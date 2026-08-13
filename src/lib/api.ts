const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "udyana_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }

  const ct = res.headers.get("content-type");
  if (ct?.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  return res.text() as unknown as T;
}

/**
 * Safe GET that returns null on 403/404 instead of throwing.
 * Use for optional data that the current user may not have access to.
 */
async function safeGet<T>(path: string): Promise<T | null> {
  try {
    return await request<T>(path);
  } catch (err: any) {
    if (err.message?.includes("403") || err.message?.includes("404") || err.message?.includes("Access denied")) {
      return null;
    }
    throw err;
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  safeGet: <T>(path: string) => safeGet<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export type SignupPayload = {
  fullName: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  role: string;
};

export type SessionUser = {
  id: number;
  fullName: string;
  username: string;
  email: string;
  phone: string;
  role: "admin" | "manager";
};

export type UserPermission = {
  id: number;
  userId: number;
  moduleKey: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPrint: boolean;
  canExport: boolean;
};
